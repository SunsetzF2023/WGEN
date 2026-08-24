import { useState } from 'react';
import type { Entity, EntityType, EntityField } from '../types';
import { ENTITY_TYPE_META, FIELD_TEMPLATES } from '../types';

interface EntityEditorProps {
  entity: Entity | null;
  allEntities: Entity[];
  onSave: (entity: Entity) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function EntityEditor({ entity, allEntities, onSave, onClose, onDelete }: EntityEditorProps) {
  const isEditing = !!entity;

  const [name, setName] = useState(entity?.name || '');
  const [type, setType] = useState<EntityType>(entity?.type || 'character');
  const [icon, setIcon] = useState(entity?.icon || '📌');
  const [summary, setSummary] = useState(entity?.summary || '');
  const [description, setDescription] = useState(entity?.description || '');
  const [imageUrl, setImageUrl] = useState(entity?.imageUrl || '');
  const [audioUrl, setAudioUrl] = useState(entity?.audioUrl || '');
  const [tags, setTags] = useState((entity?.tags || []).join(', '));
  const [fields, setFields] = useState<EntityField[]>(entity?.fields || []);
  const [relationIds, setRelationIds] = useState<string[]>(entity?.relationIds || []);

  const applyTemplate = (newType: EntityType) => {
    setType(newType);
    if (!isEditing || fields.length === 0) {
      const template = FIELD_TEMPLATES[newType];
      if (template.length > 0) {
        setFields(template.map((t) => ({ key: t.key, label: t.label, value: '' })));
      }
    }
  };

  const updateField = (i: number, key: keyof EntityField, value: string) => {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, [key]: value } : f)));
  };

  const addField = () => {
    setFields((prev) => [...prev, { key: `custom_${prev.length}`, label: '自定义', value: '' }]);
  };

  const removeField = (i: number) => {
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  };

  const toggleRelation = (id: string) => {
    setRelationIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('请输入实体名称');
      return;
    }
    const now = new Date().toISOString();
    const saved: Entity = {
      id: entity?.id || crypto.randomUUID(),
      name: name.trim(),
      type,
      icon,
      summary,
      description,
      imageUrl: imageUrl || undefined,
      audioUrl: audioUrl || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      fields: fields.filter((f) => f.value.trim() || f.linkedEntityId),
      relationIds,
      owner_id: entity?.owner_id || '',
      created_at: entity?.created_at || now,
      updated_at: now,
    };
    onSave(saved);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-slate-100">
            {isEditing ? '✏️ 编辑实体' : '➕ 创建实体'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Name + Icon + Type */}
          <div className="flex gap-3">
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-14 text-center text-2xl bg-slate-800 border border-slate-600 rounded-lg px-2 py-2"
              maxLength={2}
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="实体名称"
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">类型</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ENTITY_TYPE_META) as EntityType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => applyTemplate(t)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    type === t
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {ENTITY_TYPE_META[t].icon} {ENTITY_TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">简述</label>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="一句话概括"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">详细描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="详细描述..."
              rows={4}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 resize-y"
            />
          </div>

          {/* Media URLs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">图片 URL</label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">音频 URL</label>
              <input
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">标签（逗号分隔）</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="标签1, 标签2"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
            />
          </div>

          {/* Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-500 font-semibold">详细字段</label>
              <button onClick={addField} className="text-xs text-indigo-400 hover:text-indigo-300">+ 添加字段</button>
            </div>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input
                    value={field.label}
                    onChange={(e) => updateField(i, 'label', e.target.value)}
                    placeholder="字段名"
                    className="w-24 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 shrink-0"
                  />
                  <input
                    value={field.value}
                    onChange={(e) => updateField(i, 'value', e.target.value)}
                    placeholder="内容"
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500"
                  />
                  <select
                    value={field.linkedEntityId || ''}
                    onChange={(e) => updateField(i, 'linkedEntityId', e.target.value)}
                    className="w-32 bg-slate-800 border border-slate-600 rounded-lg px-1 py-1.5 text-xs text-slate-300 shrink-0"
                  >
                    <option value="">无链接</option>
                    {allEntities.filter((e) => e.id !== entity?.id).map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeField(i)}
                    className="text-slate-500 hover:text-red-400 text-sm shrink-0 px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Relations */}
          <div>
            <label className="text-xs text-slate-500 block mb-2">关联实体（图表中的连线）</label>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {allEntities.filter((e) => e.id !== entity?.id).map((e) => (
                <button
                  key={e.id}
                  onClick={() => toggleRelation(e.id)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    relationIds.includes(e.id)
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {e.icon} {e.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-6 py-3 flex items-center justify-between">
          <div>
            {isEditing && (
              <button
                onClick={() => { if (confirm('确定删除此实体？')) onDelete(entity!.id); }}
                className="text-sm text-red-400 hover:text-red-300"
              >
                🗑️ 删除
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
