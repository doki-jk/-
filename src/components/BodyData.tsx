import { useEffect, useMemo, useState } from 'react';
import { Activity, Plus, Trash2 } from 'lucide-react';
import { isTauriRuntime } from '../database/client';
import { bodyRecordRepository, type BodyRecord } from '../repositories/bodyRecordRepository';

function localDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function optionalNumber(form: FormData, name: string): number | null {
  const raw = String(form.get(name) ?? '').trim();
  return raw === '' ? null : Number(raw);
}

export function BodyData() {
  const [records, setRecords] = useState<BodyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    if (!isTauriRuntime()) {
      setLoading(false);
      return;
    }
    try {
      setRecords(await bodyRecordRepository.getAll());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '读取身体数据失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const latest = records[0];
  const weightChange = useMemo(() => {
    if (records.length < 2) return null;
    return records[0].weight - records[1].weight;
  }, [records]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setMessage('');
    try {
      const input = {
        recordedDate: String(form.get('recordedDate')),
        weight: Number(form.get('weight')),
        bodyFat: optionalNumber(form, 'bodyFat'),
        muscleMass: optionalNumber(form, 'muscleMass'),
        waist: optionalNumber(form, 'waist'),
        note: String(form.get('note') ?? ''),
      };
      if (!isTauriRuntime()) throw new Error('浏览器预览不会写入数据库，请在桌面版中记录');
      await bodyRecordRepository.save(input);
      await load();
      setMessage('身体数据已保存');
      formElement.reset();
      const dateInput = formElement.elements.namedItem('recordedDate') as HTMLInputElement | null;
      if (dateInput) dateInput.value = localDateKey();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function remove(record: BodyRecord) {
    if (!confirm(`确定删除 ${record.recordedDate} 的身体数据吗？`)) return;
    try {
      await bodyRecordRepository.remove(record.id);
      await load();
      setMessage('记录已删除');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败');
    }
  }

  return (
    <section className="body-data-page">
      <div className="settings-heading">
        <p className="eyebrow">身体变化</p>
        <h1>身体数据记录</h1>
        <p>记录体重、体脂、肌肉量和腰围。相同日期再次保存时会覆盖当天记录。</p>
      </div>

      <div className="body-summary-grid">
        <article className="body-summary-card"><span>最新体重</span><strong>{latest ? `${latest.weight} kg` : '--'}</strong></article>
        <article className="body-summary-card"><span>较上次变化</span><strong>{weightChange == null ? '--' : `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg`}</strong></article>
        <article className="body-summary-card"><span>最新体脂</span><strong>{latest?.bodyFat == null ? '--' : `${latest.bodyFat}%`}</strong></article>
        <article className="body-summary-card"><span>最新腰围</span><strong>{latest?.waist == null ? '--' : `${latest.waist} cm`}</strong></article>
      </div>

      <div className="body-data-grid">
        <form className="panel body-form" onSubmit={submit}>
          <div className="panel-title"><div><p className="eyebrow">新增或更新</p><h2>记录一次测量</h2></div><Activity size={20} /></div>
          <div className="goal-fields">
            <label>日期<input name="recordedDate" type="date" defaultValue={localDateKey()} required /></label>
            <label>体重 kg<input name="weight" type="number" min="1" step="0.1" required /></label>
            <label>体脂率 %<input name="bodyFat" type="number" min="0" max="100" step="0.1" /></label>
            <label>肌肉量 kg<input name="muscleMass" type="number" min="0" step="0.1" /></label>
            <label>腰围 cm<input name="waist" type="number" min="0" step="0.1" /></label>
          </div>
          <label className="body-note">备注<textarea name="note" rows={4} placeholder="例如：晨起空腹测量" /></label>
          <div className="goal-actions"><span role="status">{message}</span><button className="primary" disabled={saving}><Plus size={16} />{saving ? '保存中…' : '保存记录'}</button></div>
        </form>

        <section className="panel body-history">
          <div className="panel-title"><div><p className="eyebrow">历史数据</p><h2>测量记录</h2></div></div>
          {loading ? <p className="data-status">正在读取身体数据…</p> : records.length === 0 ? <p className="empty-state">还没有身体数据记录。</p> : (
            <div className="body-record-list">
              {records.map((record) => (
                <article className="body-record" key={record.id}>
                  <div><strong>{record.recordedDate}</strong><span>{record.note || '无备注'}</span></div>
                  <div className="body-record-values">
                    <span><b>{record.weight}</b> kg</span>
                    {record.bodyFat != null && <span><b>{record.bodyFat}</b>% 体脂</span>}
                    {record.waist != null && <span><b>{record.waist}</b> cm 腰围</span>}
                  </div>
                  <button aria-label={`删除${record.recordedDate}记录`} onClick={() => void remove(record)}><Trash2 size={16} /></button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
