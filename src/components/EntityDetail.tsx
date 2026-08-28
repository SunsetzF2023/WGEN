import { useMemo, useCallback, useState } from 'react';
import { marked } from 'marked';
import type { Entity, WorldProject } from '../types';
import { ENTITY_TYPE_META, isImageIcon } from '../types';
import { useI18n, getTypeLabel } from '../lib/i18n';
import { linkifyHtml } from '../lib/entityLink';

interface EntityDetailProps {
  entity: Entity | null;
  allEntities: Entity[];
  onSelectEntity: (id: string) => void;
  onClose: () => void;
  onEdit: () => void;
  isLoggedIn: boolean;
  onTagClick?: (tag: string) => void;
  projects?: WorldProject[];
  currentProjectId?: string | null;
  onCopyToProject?: (entity: Entity, targetProjectId: string) => void;
  readOnly?: boolean;
}

export function EntityDetail({ entity, allEntities, onSelectEntity, onClose, onEdit, isLoggedIn, onTagClick, projects, currentProjectId, onCopyToProject, readOnly }: EntityDetailProps) {
  const { t } = useI18n();
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [copyTarget, setCopyTarget] = useState<string>('');

  const handleDescriptionClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const linkEl = target.closest('.entity-link') as HTMLElement | null;
    if (linkEl) {
      const id = linkEl.getAttribute('data-entity-id');
      if (id) onSelectEntity(id);
    }
  }, [onSelectEntity]);

  // Backlinks: entities that link TO this entity
  const backlinks = useMemo(() => {
    if (!entity) return [];
    return allEntities.filter((e) =>
      e.id !== entity.id &&
      (e.relationIds.includes(entity.id) ||
        e.fields.some((f) => f.linkedEntityId === entity.id))
    );
  }, [allEntities, entity]);

  if (!entity) return null;

  const meta = ENTITY_TYPE_META[entity.type];
  const entityMap = new Map(allEntities.map((e) => [e.id, e]));

  const handleFieldClick = (linkedId?: string) => {
    if (linkedId && entityMap.has(linkedId)) {
      onSelectEntity(linkedId);
    }
  };

  const renderMarkdown = (md: string) => {
    const rawHtml = marked.parse(md, { async: false }) as string;
    const linkedHtml = linkifyHtml(rawHtml, allEntities, entity.id);
    return { __html: linkedHtml };
  };

  return (
    <div className="fixed right-0 top-0 h-full w-[420px] bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto z-50">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-5 py-4 z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {isImageIcon(entity.icon) ? (
              <img src={entity.icon} alt={entity.name} className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <span className="text-3xl">{entity.icon}</span>
            )}
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{entity.name}</h2>
              <span
                className="inline-block text-xs px-2 py-0.5 rounded-full mt-1"
                style={{ backgroundColor: meta.color + '22', color: meta.color }}
              >
                {meta.icon} {entity.customTypeLabel || getTypeLabel(entity.type, t)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 space-y-4">
        {/* Image */}
        {entity.imageUrl && (
          <img
            src={entity.imageUrl}
            alt={entity.name}
            className="w-full rounded-lg border border-slate-700"
          />
        )}

        {/* Summary */}
        {entity.summary && (
          <p className="text-sm text-slate-400 italic">{entity.summary}</p>
        )}

        {/* Description (Markdown rendered) */}
        {entity.description && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 mb-1.5 font-semibold tracking-wider">{t('overview')}</h3>
            <div
              className="text-sm text-slate-300 leading-relaxed markdown-body"
              dangerouslySetInnerHTML={renderMarkdown(entity.description)}
              onClick={handleDescriptionClick}
            />
          </div>
        )}

        {/* Fields */}
        {entity.fields.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 mb-2 font-semibold tracking-wider">{t('details')}</h3>
            <div className="space-y-1.5">
              {entity.fields.map((field, i) => {
                const linkedId = field.linkedEntityId;
                const isLinked = linkedId != null && entityMap.has(linkedId);
                const linkedEntity = isLinked ? entityMap.get(linkedId!) : null;
                return (
                  <div
                    key={i}
                    className={`flex gap-3 text-sm rounded-lg px-3 py-2 ${isLinked ? 'bg-slate-800 hover:bg-slate-700 cursor-pointer' : 'bg-slate-800/50'}`}
                    onClick={() => handleFieldClick(field.linkedEntityId)}
                  >
                    <span className="text-slate-500 min-w-[80px] shrink-0">{field.label}</span>
                    <span className="text-slate-200">
                      {field.value}
                      {linkedEntity && <span className="text-slate-500 text-xs ml-1.5">→ {isImageIcon(linkedEntity.icon) ? <img src={linkedEntity.icon} alt="" className="w-3.5 h-3.5 rounded object-cover inline" /> : linkedEntity.icon} {linkedEntity.name}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tags */}
        {entity.tags.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 mb-2 font-semibold tracking-wider">{t('tags')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {entity.tags.map((tag, i) => (
                <button
                  key={i}
                  onClick={() => onTagClick?.(tag)}
                  className={`text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 ${onTagClick ? 'hover:bg-slate-700 hover:text-slate-200 cursor-pointer transition-colors' : 'cursor-default'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Audio */}
        {entity.audioUrl && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 mb-2 font-semibold tracking-wider">{t('audio')}</h3>
            <audio controls src={entity.audioUrl} className="w-full" />
          </div>
        )}

        {/* Relations */}
        {entity.relationIds.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 mb-2 font-semibold tracking-wider">{t('relations')}</h3>
            <div className="flex flex-wrap gap-2">
              {entity.relationIds.map((rid) => {
                const rel = entityMap.get(rid);
                if (!rel) return null;
                return (
                  <button
                    key={rid}
                    onClick={() => onSelectEntity(rid)}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    <span>{isImageIcon(rel.icon) ? <img src={rel.icon} alt="" className="w-4 h-4 rounded object-cover inline" /> : rel.icon}</span>
                    <span>{rel.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Backlinks */}
        {backlinks.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 mb-2 font-semibold tracking-wider">
              {t('backlinks')} ({backlinks.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {backlinks.map((bl) => (
                <button
                  key={bl.id}
                  onClick={() => onSelectEntity(bl.id)}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <span>{isImageIcon(bl.icon) ? <img src={bl.icon} alt="" className="w-4 h-4 rounded object-cover inline" /> : bl.icon}</span>
                  <span>{bl.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Edit + Copy buttons */}
        {isLoggedIn && !readOnly && (
          <div className="space-y-2 mt-4">
            <button
              onClick={onEdit}
              className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              {t('editEntity')}
            </button>
            {onCopyToProject && projects && projects.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setShowCopyMenu(!showCopyMenu)}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm transition-colors"
                >
                  📋 {t('copyTo')}
                </button>
                {showCopyMenu && (
                  <div className="mt-2 p-3 rounded-lg bg-slate-800 border border-slate-600 space-y-2">
                    <p className="text-xs text-slate-400">{t('copyToTitle')}</p>
                    <select
                      value={copyTarget}
                      onChange={(e) => setCopyTarget(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200"
                    >
                      <option value="">—</option>
                      {projects
                        .filter((p) => p.id !== currentProjectId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.icon} {p.name}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={() => {
                        if (copyTarget && onCopyToProject) {
                          onCopyToProject(entity, copyTarget);
                          setShowCopyMenu(false);
                          setCopyTarget('');
                        }
                      }}
                      disabled={!copyTarget}
                      className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm"
                    >
                      {t('copyToConfirm')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
