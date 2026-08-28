import { useState } from 'react';
import { useI18n, LANGUAGES, type Language } from '../lib/i18n';
import type { Entity, WorldProject } from '../types';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  projects: WorldProject[];
  currentProjectId: string | null;
  entities: Entity[];
  onCreateProject: (name: string, icon: string, description: string) => void;
  onSwitchProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onTogglePublic: (projectId: string) => void;
  onResetLayout: () => void;
  onClearData: () => void;
  cloudView: 'none' | 'list' | 'browsing';
  cloudProjects: WorldProject[];
  browsingCloudProjectId: string | null;
  onEnterCloud: () => void;
  onBrowseCloudProject: (id: string) => void;
  onExitCloud: () => void;
  cloudLoading: boolean;
  isLoggedIn: boolean;
  onPlayGame: (game: string) => void;
}

export function Sidebar({
  open, onToggle, projects, currentProjectId, entities,
  onCreateProject, onSwitchProject, onDeleteProject, onTogglePublic,
  onResetLayout, onClearData,
  cloudView, cloudProjects, browsingCloudProjectId,
  onEnterCloud, onBrowseCloudProject, onExitCloud, cloudLoading, isLoggedIn,
  onPlayGame,
}: SidebarProps) {
  const { lang, setLang, t } = useI18n();
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🌐');
  const [newDesc, setNewDesc] = useState('');

  const currentProject = projects.find((p) => p.id === currentProjectId);
  const currentEntityCount = entities.filter((e) => e.project_id === currentProjectId).length;
  const currentRelationCount = entities
    .filter((e) => e.project_id === currentProjectId)
    .reduce((sum, e) => sum + e.relationIds.length, 0);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateProject(newName, newIcon, newDesc);
    setNewName('');
    setNewIcon('🌐');
    setNewDesc('');
    setShowNewProject(false);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onToggle} />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-72 bg-slate-900 border-r border-slate-700 shadow-2xl z-50 transition-transform duration-300 overflow-y-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌐</span>
            <span className="text-sm font-semibold text-slate-200">WorldForge</span>
          </div>
          <button
            onClick={onToggle}
            className="text-slate-400 hover:text-slate-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4 space-y-6">
          {/* ─── My Projects ─── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase text-slate-500 font-semibold tracking-wider flex items-center gap-1.5">
                📁 {t('myProjects')}
              </h3>
              <button
                onClick={() => setShowNewProject(!showNewProject)}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                + {t('newProject')}
              </button>
            </div>

            {/* New project form */}
            {showNewProject && (
              <div className="mb-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    className="w-10 text-center text-lg bg-slate-800 border border-slate-600 rounded px-1 py-1"
                    maxLength={2}
                  />
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('projectNamePlaceholder')}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100 placeholder-slate-500"
                  />
                </div>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t('projectDescPlaceholder')}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    className="flex-1 text-xs py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {t('save')}
                  </button>
                  <button
                    onClick={() => setShowNewProject(false)}
                    className="flex-1 text-xs py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Project list */}
            {projects.length === 0 ? (
              <p className="text-xs text-slate-500 px-3 py-2">{t('noProjects')}</p>
            ) : (
              <div className="space-y-1">
                {projects.map((p) => {
                  const count = entities.filter((e) => e.project_id === p.id).length;
                  const isActive = p.id === currentProjectId;
                  return (
                    <div
                      key={p.id}
                      className={`group rounded-lg transition-colors ${isActive ? 'bg-indigo-500/15 border border-indigo-500/30' : 'hover:bg-slate-800/50 border border-transparent'}`}
                    >
                      <button
                        onClick={() => onSwitchProject(p.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left"
                      >
                        <span className="text-lg shrink-0">{p.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-200 truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {count} {t('entityCount')}
                            {p.isPublic && <span className="ml-1 text-indigo-400">🌐 {t('cloudWorld')}</span>}
                          </div>
                        </div>
                      </button>
                      {/* Per-project actions (shown on hover or when active) */}
                      <div className={`px-3 pb-2 flex gap-2 text-[10px] ${isActive ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                        <button
                          onClick={() => onTogglePublic(p.id)}
                          className="text-slate-500 hover:text-indigo-400"
                          title={t('makePublic')}
                        >
                          {p.isPublic ? '🔒' : '🌐'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t('confirmDeleteProject'))) onDeleteProject(p.id);
                          }}
                          className="text-slate-500 hover:text-red-400"
                          title={t('delete')}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Cloud World ─── */}
          {isLoggedIn && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs uppercase text-slate-500 font-semibold tracking-wider flex items-center gap-1.5">
                  🌐 {t('cloudWorld')}
                </h3>
                {cloudView === 'none' && (
                  <button
                    onClick={onEnterCloud}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    {t('enterCloudWorld')}
                  </button>
                )}
                {cloudView !== 'none' && (
                  <button
                    onClick={onExitCloud}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    ← {t('backToMyProjects')}
                  </button>
                )}
              </div>

              {cloudView === 'list' && (
                <div className="space-y-1">
                  {cloudLoading ? (
                    <p className="text-xs text-slate-500 px-3 py-2">{t('loadingCloud')}</p>
                  ) : cloudProjects.length === 0 ? (
                    <p className="text-xs text-slate-500 px-3 py-2">{t('noCloudProjects')}</p>
                  ) : (
                    cloudProjects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => onBrowseCloudProject(p.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg border transition-colors ${
                          p.id === browsingCloudProjectId
                            ? 'bg-indigo-500/15 border-indigo-500/30'
                            : 'hover:bg-slate-800/50 border-transparent'
                        }`}
                      >
                        <span className="text-lg shrink-0">{p.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-200 truncate">{p.name}</div>
                          {p.description && (
                            <div className="text-[10px] text-slate-500 truncate">{p.description}</div>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {cloudView === 'browsing' && (
                <div className="space-y-1">
                  <p className="text-[10px] text-indigo-400 px-3">📖 {t('cloudReadOnly')}</p>
                  {cloudProjects.filter((p) => p.id !== browsingCloudProjectId).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onBrowseCloudProject(p.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg hover:bg-slate-800/50 border border-transparent"
                    >
                      <span className="text-lg shrink-0">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200 truncate">{p.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Current project stats ─── */}
          {currentProject && (
            <div>
              <h3 className="text-xs uppercase text-slate-500 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
                📊 {t('stats')}
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm bg-slate-800/50 rounded-lg px-3 py-2">
                  <span className="text-slate-400">{t('entityCount')}</span>
                  <span className="text-slate-200 font-medium">{currentEntityCount}</span>
                </div>
                <div className="flex justify-between text-sm bg-slate-800/50 rounded-lg px-3 py-2">
                  <span className="text-slate-400">{t('relationCount')}</span>
                  <span className="text-slate-200 font-medium">{currentRelationCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── Fun Games ─── */}
          <div>
            <h3 className="text-xs uppercase text-slate-500 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
              🎮 {t('funGames')}
            </h3>
            <button
              onClick={() => { onPlayGame('sudoku'); onToggle(); }}
              className="w-full text-left text-sm py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 transition-colors"
            >
              🔢 {t('sudokuTitle')}
            </button>
            <button
              onClick={() => { onPlayGame('gomoku'); onToggle(); }}
              className="w-full text-left text-sm py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 transition-colors"
            >
              ⚫ {t('gomokuTitle')}
            </button>
            <button
              onClick={() => { onPlayGame('flightchess'); onToggle(); }}
              className="w-full text-left text-sm py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 transition-colors"
            >
              ✈️ {t('fcTitle')}
            </button>
          </div>

          {/* ─── Settings ─── */}
          <div>
            <h3 className="text-xs uppercase text-slate-500 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
              ⚙️ {t('settings')}
            </h3>
            <div className="space-y-1.5">
              <button
                onClick={onResetLayout}
                className="w-full text-left text-sm py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 transition-colors"
                disabled={!currentProjectId}
              >
                🔄 {t('resetLayout')}
              </button>
              <button
                onClick={onClearData}
                className="w-full text-left text-sm py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-red-900/30 text-slate-300 hover:text-red-300 transition-colors"
                disabled={!currentProjectId}
              >
                🗑️ {t('clearData')}
              </button>
            </div>
          </div>

          {/* ─── Language ─── */}
          <div>
            <h3 className="text-xs uppercase text-slate-500 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
              🌐 {t('language')}
            </h3>
            <div className="flex gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code as Language)}
                  className={`flex-1 text-sm py-2 rounded-lg border transition-colors ${
                    lang === l.code
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 font-medium'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
                  }`}
                  title={l.label}
                >
                  {l.native}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              {LANGUAGES.find((l) => l.code === lang)?.label}
            </p>
          </div>

          {/* ─── About ─── */}
          <div>
            <h3 className="text-xs uppercase text-slate-500 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
              ℹ️ {t('about')}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed px-3">
              {t('aboutText')}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
