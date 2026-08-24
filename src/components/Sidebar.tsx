import { useState } from 'react';
import { useI18n, LANGUAGES, type Language } from '../lib/i18n';
import type { Entity } from '../types';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  entities: Entity[];
  onResetLayout: () => void;
  onClearData: () => void;
}

export function Sidebar({ open, onToggle, entities, onResetLayout, onClearData }: SidebarProps) {
  const { lang, setLang, t } = useI18n();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearInput, setClearInput] = useState('');

  const relationCount = entities.reduce((sum, e) => sum + e.relationIds.length, 0);
  const clearWord = t('confirmWord');
  const clearArmed = clearInput.trim() === clearWord;

  /** Never leave a destructive action armed after the sidebar closes */
  const closeSidebar = () => {
    setConfirmingReset(false);
    setConfirmingClear(false);
    setClearInput('');
    onToggle();
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-72 bg-slate-900 border-r border-slate-700 shadow-2xl z-50 transition-transform duration-300 overflow-y-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌐</span>
            <span className="text-sm font-semibold text-slate-200">WorldForge</span>
          </div>
          <button
            onClick={closeSidebar}
            className="text-slate-400 hover:text-slate-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4 space-y-6">
          {/* Language */}
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

          {/* Stats */}
          <div>
            <h3 className="text-xs uppercase text-slate-500 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
              📊 {t('stats')}
            </h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="text-slate-400">{t('entityCount')}</span>
                <span className="text-slate-200 font-medium">{entities.length}</span>
              </div>
              <div className="flex justify-between text-sm bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="text-slate-400">{t('relationCount')}</span>
                <span className="text-slate-200 font-medium">{relationCount}</span>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div>
            <h3 className="text-xs uppercase text-slate-500 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
              ⚙️ {t('settings')}
            </h3>
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-3 space-y-3">
              <p className="text-xs text-red-400/80 font-semibold">⚠️ {t('dangerZone')}</p>

              {confirmingReset ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-300 leading-relaxed">{t('confirmResetLayout')}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setConfirmingReset(false);
                        setConfirmingClear(false);
                        setClearInput('');
                        onResetLayout();
                      }}
                      className="flex-1 text-sm py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                    >
                      {t('confirmYes')}
                    </button>
                    <button
                      onClick={() => setConfirmingReset(false)}
                      className="flex-1 text-sm py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setConfirmingReset(true);
                    setConfirmingClear(false);
                  }}
                  className="w-full text-left text-sm py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 transition-colors"
                >
                  🔄 {t('resetLayout')}
                </button>
              )}

              {confirmingClear ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {t('confirmTypeHint')
                      .replace('{word}', `「${clearWord}」`)
                      .replace('{count}', String(entities.length))}
                  </p>
                  <input
                    autoFocus
                    value={clearInput}
                    onChange={(e) => setClearInput(e.target.value)}
                    placeholder={clearWord}
                    className="w-full text-sm py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:border-red-500 outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={!clearArmed}
                      onClick={() => {
                        setConfirmingClear(false);
                        setClearInput('');
                        onClearData();
                      }}
                      className="flex-1 text-sm py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white transition-colors"
                    >
                      {t('confirmClearAction')}
                    </button>
                    <button
                      onClick={() => {
                        setConfirmingClear(false);
                        setClearInput('');
                      }}
                      className="flex-1 text-sm py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setConfirmingClear(true);
                    setConfirmingReset(false);
                  }}
                  className="w-full text-left text-sm py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-red-900/30 text-slate-300 hover:text-red-300 transition-colors"
                >
                  🗑️ {t('clearData')}
                </button>
              )}
            </div>
          </div>

          {/* About */}
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
