import { useEffect, useState } from 'react';
import { Dumbbell, Moon, Save } from 'lucide-react';
import { goalRepository, type DayType } from '../repositories/goalRepository';
import { useNutritionStore } from '../store/useNutritionStore';
import type { DailyGoal } from '../types';
import './GoalSettings.css';

const labels: Record<keyof DailyGoal, string> = {
  calories: '热量 kcal',
  protein: '蛋白质 g',
  carbs: '碳水 g',
  fat: '脂肪 g',
};

function GoalForm({ dayType, title }: { dayType: DayType; title: string }) {
  const saveGoal = useNutritionStore((state) => state.saveGoal);
  const [value, setValue] = useState<DailyGoal>(goalRepository.defaults[dayType]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setMessage('');
      try {
        const goal = await goalRepository.get(dayType);
        if (active) setValue(goal);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : '读取目标失败');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [dayType]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await saveGoal(dayType, value);
      setMessage('目标已保存到当前设备');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  const Icon = dayType === 'training' ? Dumbbell : Moon;

  return (
    <form className="goal-card" onSubmit={submit}>
      <div className="goal-card-title">
        <span><Icon size={19} /></span>
        <div><p className="eyebrow">{dayType === 'training' ? 'Training day' : 'Rest day'}</p><h2>{title}</h2></div>
      </div>
      <div className="goal-fields">
        {(Object.keys(labels) as Array<keyof DailyGoal>).map((key) => (
          <label key={key}>
            {labels[key]}
            <input
              type="number"
              min={key === 'calories' ? 1 : 0}
              step="1"
              disabled={loading || saving}
              value={value[key]}
              onChange={(event) => setValue((current) => ({ ...current, [key]: Number(event.target.value) }))}
            />
          </label>
        ))}
      </div>
      <div className="goal-actions">
        <span role="status">{loading ? '正在读取…' : message}</span>
        <button className="primary" type="submit" disabled={loading || saving}>
          <Save size={16} />{saving ? '保存中…' : '保存目标'}
        </button>
      </div>
    </form>
  );
}

export function GoalSettings() {
  return (
    <section className="goal-settings">
      <div className="settings-heading">
        <p className="eyebrow">营养计划</p>
        <h1>训练日和休息日目标</h1>
        <p>分别设置两种日程的热量与三大营养素，切换日程时首页目标会自动更新。</p>
      </div>
      <div className="goal-grid">
        <GoalForm dayType="training" title="训练日目标" />
        <GoalForm dayType="rest" title="休息日目标" />
      </div>
    </section>
  );
}
