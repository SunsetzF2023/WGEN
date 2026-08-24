import { useState, useEffect, useCallback } from 'react';
import type { Entity, EntityType } from './types';
import { ENTITY_TYPE_META } from './types';
import { GraphView } from './components/GraphView';
import { EntityDetail } from './components/EntityDetail';
import { EntityEditor } from './components/EntityEditor';
import { Sidebar } from './components/Sidebar';
import { supabase, signInWithGitHub, signOut } from './lib/supabase';
import { loadLocalEntities, saveLocalEntities, loadCloudEntities, saveCloudEntity, deleteCloudEntity } from './lib/dataStore';
import { SEED_ENTITIES } from './lib/seedData';
import { useI18n, getTypeLabel } from './lib/i18n';

type AuthState = 'loading' | 'logged_in' | 'logged_out';

export default function App() {
  const { t } = useI18n();
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<EntityType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [showSeedPrompt, setShowSeedPrompt] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth init
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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
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

  // Load entities when auth state changes
  useEffect(() => {
    if (authState === 'logged_in' && user) {
      loadCloudEntities(user.id).then((cloud) => {
        if (cloud.length === 0) {
          setShowSeedPrompt(true);
        }
        setEntities(cloud);
      }).catch(() => {
        setShowSeedPrompt(true);
        setEntities([]);
      });
    } else if (authState === 'logged_out') {
      const local = loadLocalEntities();
      if (local.length === 0) {
        setShowSeedPrompt(true);
      }
      setEntities(local);
    }
  }, [authState, user]);

  // Save to local storage when not logged in
  useEffect(() => {
    if (authState === 'logged_out') {
      saveLocalEntities(entities);
    }
  }, [entities, authState]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleSaveEntity = async (entity: Entity) => {
    const withOwner = { ...entity, owner_id: user?.id || 'local' };
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

  const handleLoadSeed = () => {
    const seed = SEED_ENTITIES.map((e) => ({
      ...e,
      owner_id: user?.id || 'local',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    setEntities(seed);
    setShowSeedPrompt(false);
  };

  const handleNewEntity = () => {
    setEditingEntity(null);
    setShowEditor(true);
  };

  const handleEditEntity = () => {
    const entity = entities.find((e) => e.id === selectedId);
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
    const data = JSON.stringify(entities, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worldforge-${new Date().toISOString().slice(0, 10)}.json`;
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
          updated_at: new Date().toISOString(),
        }));
        setEntities(imported);
        setShowSeedPrompt(false);
      } catch {
        alert(t('importError'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtered entities for graph
  const filteredEntities = entities.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (searchQuery && !e.name.includes(searchQuery) && !e.tags.some((t) => t.includes(searchQuery))) return false;
    return true;
  });

  const selectedEntity = entities.find((e) => e.id === selectedId) || null;

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
        entities={entities}
        onResetLayout={() => {
          setEntities((prev) => prev.map((e) => ({ ...e, position: undefined })));
          setSidebarOpen(false);
        }}
        onClearData={() => {
          setEntities([]);
          setSelectedId(null);
          setSidebarOpen(false);
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
          <span className="text-xl">🌐</span>
          <span className="text-sm font-semibold text-slate-200">{t('appTitle')}</span>
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
          {entities.length > 0 && (
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
          {t('all')} ({entities.length})
        </button>
        {(Object.keys(ENTITY_TYPE_META) as EntityType[]).map((tp) => {
          const count = entities.filter((e) => e.type === tp).length;
          if (count === 0) return null;
          return (
            <button
              key={tp}
              onClick={() => setFilterType(tp)}
              className={`text-xs px-2.5 py-1 rounded-lg ${filterType === tp ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {ENTITY_TYPE_META[tp].icon} {getTypeLabel(tp, t)} ({count})
            </button>
          );
        })}
      </div>

      {/* Main content: graph + detail panel */}
      <div className="flex-1 relative overflow-hidden">
        {entities.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-5xl mb-4">🌐</div>
              <h2 className="text-xl text-slate-200 mb-2">{t('emptyTitle')}</h2>
              <p className="text-sm text-slate-500 mb-6">
                {t('emptyDesc')}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleNewEntity}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
                >
                  {t('createFirst')}
                </button>
                {showSeedPrompt && (
                  <button
                    onClick={handleLoadSeed}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm"
                  >
                    {t('loadSeed')}
                  </button>
                )}
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
            allEntities={entities}
            onSelectEntity={handleSelect}
            onClose={() => setSelectedId(null)}
            onEdit={handleEditEntity}
            isLoggedIn={authState === 'logged_in'}
          />
        )}

        {/* Editor modal */}
        {showEditor && (
          <EntityEditor
            entity={editingEntity}
            allEntities={entities}
            onSave={handleSaveEntity}
            onClose={() => { setShowEditor(false); setEditingEntity(null); }}
            onDelete={handleDeleteEntity}
          />
        )}
      </div>
    </div>
  );
}
