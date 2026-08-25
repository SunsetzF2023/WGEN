import { useState, useEffect, useCallback } from 'react';
import type { Entity, EntityType, WorldProject } from './types';
import { ENTITY_TYPE_META } from './types';
import { GraphView } from './components/GraphView';
import { EntityDetail } from './components/EntityDetail';
import { EntityEditor } from './components/EntityEditor';
import { Sidebar } from './components/Sidebar';
import { supabase, signInWithGitHub, signOut } from './lib/supabase';
import {
  loadLocalEntities, saveLocalEntities, loadCloudEntities, saveCloudEntity, deleteCloudEntity, deleteCloudEntitiesByProject,
  loadLocalProjects, saveLocalProjects, loadCloudProjects, saveCloudProject, deleteCloudProject,
} from './lib/dataStore';
import { SEED_ENTITIES, SEED_PROJECT } from './lib/seedData';
import { useI18n, getTypeLabel } from './lib/i18n';

type AuthState = 'loading' | 'logged_in' | 'logged_out';

export default function App() {
  const { t } = useI18n();
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [projects, setProjects] = useState<WorldProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<EntityType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const currentProject = projects.find((p) => p.id === currentProjectId) || null;

  // ─── Auth init ───
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        const u = data.session.user;
        const name = (u.user_metadata?.user_name || u.user_metadata?.full_name || 'User') as string;
        setUser({ id: u.id, name });
        setAuthState('logged_in');
      } else {
        setAuthState('logged_out');
      }
    }).catch(() => {
      setAuthState('logged_out');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore TOKEN_REFRESHED — it fires on tab refocus and would trigger
      // unnecessary data reloads that overwrite local state.
      if (event === 'TOKEN_REFRESHED') return;
      if (session?.user) {
        const u = session.user;
        const name = (u.user_metadata?.user_name || u.user_metadata?.full_name || 'User') as string;
        setUser({ id: u.id, name });
        setAuthState('logged_in');
      } else {
        setUser(null);
        setAuthState('logged_out');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // ─── Load projects + entities when auth state changes ───
  useEffect(() => {
    if (authState === 'logged_in' && user) {
      setDataLoading(true);
      Promise.all([
        loadCloudProjects(user.id),
        loadCloudEntities(user.id),
      ]).then(async ([cloudProjects, cloudEntities]) => {
        if (cloudProjects.length === 0) {
          // Auto-create seed project + entities for first-time users
          await handleLoadSeed();
        } else {
          setProjects(cloudProjects);
          setEntities(cloudEntities);
          setCurrentProjectId(cloudProjects[0].id);
        }
      }).catch(() => {
        setProjects([]);
        setEntities([]);
      }).finally(() => {
        setDataLoading(false);
      });
    } else if (authState === 'logged_out') {
      const localProjects = loadLocalProjects();
      const localEntities = loadLocalEntities();
      if (localProjects.length === 0) {
        // Auto-create seed project + entities for first-time local users
        handleLoadSeed();
      } else {
        setProjects(localProjects);
        setEntities(localEntities);
        setCurrentProjectId(localProjects[0].id);
      }
    }
  }, [authState, user]);

  // ─── Save to local storage when not logged in ───
  useEffect(() => {
    if (authState === 'logged_out') {
      saveLocalProjects(projects);
    }
  }, [projects, authState]);

  useEffect(() => {
    if (authState === 'logged_out') {
      saveLocalEntities(entities);
    }
  }, [entities, authState]);

  // ─── Entities for the current project only ───
  const projectEntities = entities.filter((e) => e.project_id === currentProjectId);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // ─── Project handlers ───
  const handleCreateProject = (name: string, icon: string, description: string) => {
    const now = new Date().toISOString();
    const project: WorldProject = {
      id: crypto.randomUUID(),
      name: name.trim() || t('newProject'),
      icon: icon || '🌐',
      description,
      isPublic: false,
      owner_id: user?.id || 'local',
      created_at: now,
      updated_at: now,
    };
    setProjects((prev) => [...prev, project]);
    setCurrentProjectId(project.id);
    setSelectedId(null);
    if (authState === 'logged_in') {
      saveCloudProject(project);
    }
  };

  const handleSwitchProject = (projectId: string) => {
    setCurrentProjectId(projectId);
    setSelectedId(null);
    setSidebarOpen(false);
  };

  const handleDeleteProject = async (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setEntities((prev) => prev.filter((e) => e.project_id !== projectId));
    if (currentProjectId === projectId) {
      const remaining = projects.filter((p) => p.id !== projectId);
      setCurrentProjectId(remaining.length > 0 ? remaining[0].id : null);
    }
    if (authState === 'logged_in') {
      await deleteCloudEntitiesByProject(projectId);
      await deleteCloudProject(projectId);
    }
  };

  const handleTogglePublic = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const updated = { ...project, isPublic: !project.isPublic, updated_at: new Date().toISOString() };
    setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
    if (authState === 'logged_in') {
      await saveCloudProject(updated);
    }
  };

  // ─── Entity handlers ───
  const handleSaveEntity = async (entity: Entity) => {
    const withOwner = { ...entity, owner_id: user?.id || 'local', project_id: currentProjectId || '' };
    setEntities((prev) => {
      const idx = prev.findIndex((e) => e.id === entity.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = withOwner;
        return next;
      }
      return [...prev, withOwner];
    });
    if (authState === 'logged_in') {
      await saveCloudEntity(withOwner);
    }
    setShowEditor(false);
    setEditingEntity(null);
  };

  const handleDeleteEntity = async (id: string) => {
    setEntities((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (authState === 'logged_in') {
      await deleteCloudEntity(id);
    }
    setShowEditor(false);
    setEditingEntity(null);
  };

  const handleLoadSeed = async () => {
    const now = new Date().toISOString();
    const ownerId = user?.id || 'local';

    // Generate proper UUIDs — Supabase id columns are uuid type, but seed
    // data uses string IDs like "seed-character-叶逍云". We must remap.
    const projectId = crypto.randomUUID();
    const idMap = new Map<string, string>();
    for (const e of SEED_ENTITIES) {
      idMap.set(e.id, crypto.randomUUID());
    }

    const seedProject: WorldProject = {
      ...SEED_PROJECT,
      id: projectId,
      owner_id: ownerId,
      created_at: now,
      updated_at: now,
    };

    const seed: Entity[] = SEED_ENTITIES.map((e) => ({
      ...e,
      id: idMap.get(e.id)!,
      owner_id: ownerId,
      project_id: projectId,
      relationIds: e.relationIds.map((rid) => idMap.get(rid) || rid),
      fields: e.fields.map((f) => ({
        ...f,
        linkedEntityId: f.linkedEntityId ? (idMap.get(f.linkedEntityId) || f.linkedEntityId) : undefined,
      })),
      created_at: now,
      updated_at: now,
    }));

    setProjects((prev) => [...prev, seedProject]);
    setEntities((prev) => [...prev, ...seed]);
    setCurrentProjectId(projectId);

    if (authState === 'logged_in') {
      // Must await project save before entities — FK constraint requires
      // project to exist before entities can reference it.
      await saveCloudProject(seedProject);
      await Promise.all(seed.map((e) => saveCloudEntity(e)));
    }
  };

  const handleNewEntity = () => {
    if (!currentProjectId) {
      // Auto-create a default project if none exists
      handleCreateProject(t('newProject'), '🌐', '');
    }
    setEditingEntity(null);
    setShowEditor(true);
  };

  const handleEditEntity = () => {
    const entity = projectEntities.find((e) => e.id === selectedId);
    if (entity) {
      setEditingEntity(entity);
      setShowEditor(true);
    }
  };

  const handlePositionChange = useCallback((id: string, x: number, y: number) => {
    setEntities((prev) => prev.map((e) =>
      e.id === id ? { ...e, position: { x, y } } : e
    ));
  }, []);

  const handleExport = () => {
    const data = JSON.stringify(projectEntities, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject?.name || 'worldforge'}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(data)) throw new Error('Invalid format');
        const imported = data.map((e: Entity) => ({
          ...e,
          owner_id: user?.id || 'local',
          project_id: currentProjectId || '',
          updated_at: new Date().toISOString(),
        }));
        setEntities((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          return [...prev, ...imported.filter((e: Entity) => !existingIds.has(e.id))];
        });
      } catch {
        alert(t('importError'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ─── Filtered entities for graph (within current project) ───
  const filteredEntities = projectEntities.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (searchQuery && !e.name.includes(searchQuery) && !e.tags.some((t) => t.includes(searchQuery))) return false;
    return true;
  });

  const selectedEntity = projectEntities.find((e) => e.id === selectedId) || null;

  if (authState === 'loading') {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400">
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        projects={projects}
        currentProjectId={currentProjectId}
        entities={entities}
        onCreateProject={handleCreateProject}
        onSwitchProject={handleSwitchProject}
        onDeleteProject={handleDeleteProject}
        onTogglePublic={handleTogglePublic}
        onResetLayout={() => {
          setEntities((prev) => prev.map((e) =>
            e.project_id === currentProjectId ? { ...e, position: undefined } : e
          ));
          setSidebarOpen(false);
        }}
        onClearData={() => {
          if (currentProjectId && confirm(t('confirmDeleteProject'))) {
            handleDeleteProject(currentProjectId);
            setSidebarOpen(false);
          }
        }}
      />

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-slate-200 text-lg leading-none"
            title={t('menu')}
          >
            ☰
          </button>
          <span className="text-xl">{currentProject?.icon || '🌐'}</span>
          <span className="text-sm font-semibold text-slate-200">
            {currentProject ? currentProject.name : t('appTitle')}
          </span>
          {currentProject?.isPublic && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">🌐 {t('cloudWorld')}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search')}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 w-40"
          />

          {/* New entity button */}
          <button
            onClick={handleNewEntity}
            className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
          >
            {t('newEntity')}
          </button>

          {/* Export / Import */}
          {projectEntities.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleExport}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300"
                title={t('export')}
              >
                {t('export')}
              </button>
              <label className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 cursor-pointer" title={t('import')}>
                {t('import')}
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
            </div>
          )}

          {/* Auth */}
          {authState === 'logged_in' && user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">{user.name}</span>
              <button
                onClick={() => signOut()}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                {t('logout')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => signInWithGitHub()}
              className="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300"
            >
              {t('loginGithub')}
            </button>
          )}
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900/50 border-b border-slate-800 shrink-0">
        <button
          onClick={() => setFilterType('all')}
          className={`text-xs px-2.5 py-1 rounded-lg ${filterType === 'all' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
        >
          {t('all')} ({projectEntities.length})
        </button>
        {(Object.keys(ENTITY_TYPE_META) as EntityType[]).map((tp) => {
          const entitiesOfType = projectEntities.filter((e) => e.type === tp);
          const count = entitiesOfType.length;
          if (count === 0) return null;
          let label = getTypeLabel(tp, t);
          if (tp === 'custom') {
            const customLabels = [...new Set(entitiesOfType.map((e) => e.customTypeLabel).filter(Boolean))];
            if (customLabels.length === 1) {
              label = customLabels[0]!;
            } else if (customLabels.length > 1) {
              label = `${getTypeLabel(tp, t)} (${customLabels.length})`;
            }
          }
          return (
            <button
              key={tp}
              onClick={() => setFilterType(tp)}
              className={`text-xs px-2.5 py-1 rounded-lg ${filterType === tp ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {ENTITY_TYPE_META[tp].icon} {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Main content: graph + detail panel */}
      <div className="flex-1 relative overflow-hidden">
        {dataLoading ? (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-slate-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">{t('loading')}</span>
            </div>
          </div>
        ) : !currentProject ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-5xl mb-4">🌐</div>
              <h2 className="text-xl text-slate-200 mb-2">{t('emptyTitle')}</h2>
              <p className="text-sm text-slate-500 mb-6">
                {t('emptyDesc')}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
                >
                  {t('newProject')}
                </button>
              </div>
            </div>
          </div>
        ) : projectEntities.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-5xl mb-4">{currentProject.icon}</div>
              <h2 className="text-xl text-slate-200 mb-2">{currentProject.name}</h2>
              <p className="text-sm text-slate-500 mb-6">
                {currentProject.description || t('emptyDesc')}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleNewEntity}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
                >
                  {t('createFirst')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <GraphView
            entities={filteredEntities}
            selectedId={selectedId}
            onSelect={handleSelect}
            onPositionChange={handlePositionChange}
          />
        )}

        {/* Detail panel */}
        {selectedEntity && (
          <EntityDetail
            entity={selectedEntity}
            allEntities={projectEntities}
            onSelectEntity={handleSelect}
            onClose={() => setSelectedId(null)}
            onEdit={handleEditEntity}
            isLoggedIn={authState === 'logged_in'}
            onTagClick={(tag) => setSearchQuery(tag)}
          />
        )}

        {/* Editor modal */}
        {showEditor && (
          <EntityEditor
            entity={editingEntity}
            allEntities={projectEntities}
            onSave={handleSaveEntity}
            onClose={() => { setShowEditor(false); setEditingEntity(null); }}
            onDelete={handleDeleteEntity}
          />
        )}
      </div>
    </div>
  );
}
