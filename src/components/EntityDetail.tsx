import type { Entity } from '../types';
import { ENTITY_TYPE_META } from '../types';

interface EntityDetailProps {
  entity: Entity | null;
  allEntities: Entity[];
  onSelectEntity: (id: string) => void;
  onClose: () => void;
  onEdit: () => void;
  isLoggedIn: boolean;
}

export function EntityDetail({ entity, allEntities, onSelectEntity, onClose, onEdit, isLoggedIn }: EntityDetailProps) {
  if (!entity) return null;

  const meta = ENTITY_TYPE_META[entity.type];
  const entityMap = new Map(allEntities.map((e) => [e.id, e]));

  const handleFieldClick = (linkedId?: string) => {
    if (linkedId && entityMap.has(linkedId)) {
      onSelectEntity(linkedId);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-[420px] bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto z-50">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-5 py-4 z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{entity.icon}</span>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{entity.name}</h2>
              <span
                className="inline-block text-xs px-2 py-0.5 rounded-full mt-1"
                style={{ backgroundColor: meta.color + '22', color: meta.color }}
              >
                {meta.icon} {meta.label}
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

        {/* Description */}
        {entity.description && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 mb-1.5 font-semibold tracking-wider">概述</h3>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{entity.description}</p>
          </div>
        )}

        {/* Fields */}
        {entity.fields.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 mb-2 font-semibold tracking-wider">详细资料</h3>
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
                      {linkedEntity && <span className="text-slate-500 text-xs ml-1.5">→ {linkedEntity.icon} {linkedEntity.name}</span>}
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
            <h3 className="text-xs uppercase text-slate-500 mb-2 font-semibold tracking-wider">标签</h3>
            <div className="flex flex-wrap gap-1.5">
              {entity.tags.map((tag, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Audio */}
        {entity.audioUrl && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 mb-2 font-semibold tracking-wider">音频</h3>
            <audio controls src={entity.audioUrl} className="w-full" />
          </div>
        )}

        {/* Relations */}
        {entity.relationIds.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 mb-2 font-semibold tracking-wider">关联实体</h3>
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
                    <span>{rel.icon}</span>
                    <span>{rel.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Edit button */}
        {isLoggedIn && (
          <button
            onClick={onEdit}
            className="w-full mt-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            ✏️ 编辑实体
          </button>
        )}
      </div>
    </div>
  );
}
