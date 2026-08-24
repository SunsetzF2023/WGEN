import { useState, useRef } from 'react';
import { marked } from 'marked';
import type { Entity, EntityType, EntityField } from '../types';
import { ENTITY_TYPE_META, FIELD_TEMPLATES, isImageIcon } from '../types';
import { useI18n, getTypeLabel } from '../lib/i18n';

interface EntityEditorProps {
  entity: Entity | null;
  allEntities: Entity[];
  onSave: (entity: Entity) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function EntityEditor({ entity, allEntities, onSave, onClose, onDelete }: EntityEditorProps) {
  const { t } = useI18n();
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
  const [mdPreview, setMdPreview] = useState(false);
  const [customTypeLabel, setCustomTypeLabel] = useState(entity?.customTypeLabel || '');
  const [iconMode, setIconMode] = useState<'emoji' | 'image'>(() => isImageIcon(entity?.icon || '') ? 'image' : 'emoji');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconFile = (file: File) => {
    if (file.size > 512 * 1024) {
      alert(t('iconFileTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) setIcon(result);
    };
    reader.readAsDataURL(file);
  };

  const applyTemplate = (newType: EntityType) => {
    setType(newType);
    // Smart icon sync: if current icon is still the previous type's default
    // (or an image that happens to match — unlikely), swap to new type's default.
    // If the user has customized the icon, leave it alone.
    const prevDefault = ENTITY_TYPE_META[type]?.icon;
    const newDefault = ENTITY_TYPE_META[newType]?.icon;
    if (icon === prevDefault && newDefault) {
      setIcon(newDefault);
      setIconMode('emoji');
    }
    if (!isEditing || fields.length === 0) {
      const template = FIELD_TEMPLATES[newType];
      if (template.length > 0) {
        setFields(template.map((t) => ({ key: t.key, label: t.label, value: '' })));
      }
    }
  };

  const resetIconToTypeDefault = () => {
    const def = ENTITY_TYPE_META[type]?.icon || '📌';
    setIcon(def);
    setIconMode('emoji');
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
      alert(t('enterName'));
      return;
    }
    const now = new Date().toISOString();
    const saved: Entity = {
      id: entity?.id || crypto.randomUUID(),
      name: name.trim(),
      type,
      customTypeLabel: type === 'custom' ? customTypeLabel.trim() : undefined,
      icon,
      summary,
      description,
      imageUrl: imageUrl || undefined,
      audioUrl: audioUrl || undefined,
      tags: tags.split(/[,，;；]/).map((tag) => tag.trim()).filter(Boolean),
      fields: fields.filter((f) => f.value.trim() || f.linkedEntityId),
      relationIds,
      owner_id: entity?.owner_id || '',
      project_id: entity?.project_id || '',
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
            {isEditing ? t('editTitle') : t('createTitle')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Name + Icon + Type */}
          <div className="flex gap-3">
            {/* Icon picker */}
            <div className="shrink-0">
              <div className="w-14 h-14 flex items-center justify-center bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
                {iconMode === 'image' && isImageIcon(icon) ? (
                  <img src={icon} alt="icon" className="w-full h-full object-cover" />
                ) : (
                  <input
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full h-full text-center text-2xl bg-transparent text-slate-100 outline-none"
                    maxLength={2}
                  />
                )}
              </div>
              <div className="flex mt-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => { setIconMode('emoji'); if (isImageIcon(icon)) setIcon(ENTITY_TYPE_META[type]?.icon || '📌'); }}
                  className={`flex-1 py-0.5 rounded-l ${iconMode === 'emoji' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {t('iconEmoji')}
                </button>
                <button
                  type="button"
                  onClick={() => setIconMode('image')}
                  className={`flex-1 py-0.5 rounded-r ${iconMode === 'image' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {t('iconImage')}
                </button>
              </div>
              {/* Reset to type default — only show when icon differs from type default */}
              {icon !== ENTITY_TYPE_META[type]?.icon && (
                <button
                  type="button"
                  onClick={resetIconToTypeDefault}
                  className="mt-1 w-full text-[10px] text-slate-500 hover:text-indigo-400 transition-colors"
                  title={t('iconResetTitle')}
                >
                  ↺ {t('iconReset')}
                </button>
              )}
            </div>

            {/* Image URL / upload (only in image mode) */}
            {iconMode === 'image' && (
              <div className="flex-1 flex flex-col gap-1.5">
                <input
                  value={isImageIcon(icon) ? icon : ''}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder={t('iconUrlPlaceholder')}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-indigo-400 hover:text-indigo-300 self-start"
                >
                  📁 {t('iconUpload')}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleIconFile(file);
                    e.target.value = '';
                  }}
                />
              </div>
            )}

            {/* Name (full width if emoji mode) */}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('enterName')}
              className={`bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 ${iconMode === 'image' ? 'hidden' : 'flex-1'}`}
            />
          </div>

          {/* Name input shown below when in image mode */}
          {iconMode === 'image' && (
            <div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('enterName')}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500 block mb-1">{t('typeLabel')}</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ENTITY_TYPE_META) as EntityType[]).map((tp) => (
                <button
                  key={tp}
                  onClick={() => applyTemplate(tp)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    type === tp
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {ENTITY_TYPE_META[tp].icon} {getTypeLabel(tp, t)}
                </button>
              ))}
            </div>
          </div>

          {/* Custom type label input */}
          {type === 'custom' && (
            <div>
              <label className="text-xs text-slate-500 block mb-1">{t('customTypeLabel')}</label>
              <input
                value={customTypeLabel}
                onChange={(e) => setCustomTypeLabel(e.target.value)}
                placeholder={t('customTypePlaceholder')}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
              />
            </div>
          )}

          {/* Summary */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">{t('summary')}</label>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t('summaryPlaceholder')}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
            />
          </div>

          {/* Description with Markdown toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-500">{t('description')}</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setMdPreview(false)}
                  className={`text-xs px-2 py-0.5 rounded ${!mdPreview ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {t('mdEdit')}
                </button>
                <button
                  type="button"
                  onClick={() => setMdPreview(true)}
                  className={`text-xs px-2 py-0.5 rounded ${mdPreview ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {t('mdPreview')}
                </button>
              </div>
            </div>
            {mdPreview ? (
              <div
                className="w-full min-h-[100px] bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-300 markdown-body"
                dangerouslySetInnerHTML={{ __html: marked.parse(description || t('mdEmpty'), { async: false }) as string }}
              />
            ) : (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="支持 Markdown 语法…&#10;## 标题&#10;**粗体** *斜体*&#10;- 列表项&#10;> 引用"
                rows={5}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 resize-y font-mono"
              />
            )}
          </div>

          {/* Media URLs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">{t('imageUrl')}</label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">{t('audioUrl')}</label>
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
            <label className="text-xs text-slate-500 block mb-1">{t('tagsLabel')}</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('tagsPlaceholder')}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
            />
          </div>

          {/* Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-500 font-semibold">{t('fieldsLabel')}</label>
              <button onClick={addField} className="text-xs text-indigo-400 hover:text-indigo-300">{t('addField')}</button>
            </div>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input
                    value={field.label}
                    onChange={(e) => updateField(i, 'label', e.target.value)}
                    placeholder={t('fieldName')}
                    className="w-24 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 shrink-0"
                  />
                  <input
                    value={field.value}
                    onChange={(e) => updateField(i, 'value', e.target.value)}
                    placeholder={t('fieldValue')}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500"
                  />
                  <select
                    value={field.linkedEntityId || ''}
                    onChange={(e) => updateField(i, 'linkedEntityId', e.target.value)}
                    className="w-32 bg-slate-800 border border-slate-600 rounded-lg px-1 py-1.5 text-xs text-slate-300 shrink-0"
                  >
                    <option value="">{t('noLink')}</option>
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
            <label className="text-xs text-slate-500 block mb-2">{t('relationsLabel')}</label>
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
                  {isImageIcon(e.icon) ? <img src={e.icon} alt="" className="w-4 h-4 rounded object-cover inline" /> : e.icon} {e.name}
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
                onClick={() => { if (confirm(t('confirmDelete'))) onDelete(entity!.id); }}
                className="text-sm text-red-400 hover:text-red-300"
              >
                {t('delete')}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
            >
              {t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
