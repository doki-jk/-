import { Calculator, Save, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { userProfileRepository } from '../repositories/userProfileRepository';
import { useNutritionStore } from '../store/useNutritionStore';
import {
  calculateGoalRecommendation,
  type GoalProfile,
  type GoalRecommendation as Recommendation,
} from '../utils/goalCalculator';
import '../goal-recommendation.css';

const activityLabels: Record<GoalProfile['activityLevel'], string> = {
  sedentary: '久坐，日常活动较少',
  light: '轻度活动，每周训练 1–3 次',
  moderate: '中等活动，每周训练 3–5 次',
  high: '高活动量，每周训练 6 次以上',
};

const objectiveLabels: Record<GoalProfile['objective'], string> = {
  cut: '减脂',
  maintain: '维持',
  gain: '增肌',
};

interface GoalRecommendationProps {
  onApplied?: () => void;
}

export function GoalRecommendation({ onApplied }: GoalRecommendationProps) {
  const applyGoals = useNutritionStore((state) => state.applyGoals);
  const [profile, setProfile] = useState<GoalProfile | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void userProfileRepository.get().then((value) => {
      if (!active) return;
      setProfile(value);
      try {
        setRecommendation(calculateGoalRecommendation(value));
      } catch {
        setRecommendation(null);
      }
    }).catch((error) => {
      if (!active) return;
      setMessage(error instanceof Error ? error.message : '读取个人资料失败');
    });
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => recommendation ? [
    ['基础代谢估算', `${recommendation.bmr} kcal`],
    ['维持热量估算', `${recommendation.maintenanceCalories} kcal`],
    ['训练日建议', `${recommendation.training.calories} kcal`],
    ['休息日建议', `${recommendation.rest.calories} kcal`],
  ] : [], [recommendation]);

  if (!profile) return <p className="data-status">正在读取个人资料…</p>;

  function update<K extends keyof GoalProfile>(key: K, value: GoalProfile[K]) {
    setProfile((current) => current ? { ...current, [key]: value } : current);
    setMessage('资料已修改，点击“重新计算”生成新建议。');
  }

  async function calculate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentProfile = profile;
    if (!currentProfile) return;
    setMessage('');
    try {
      const value = calculateGoalRecommendation(currentProfile);
      await userProfileRepository.save(currentProfile);
      setRecommendation(value);
      setMessage('建议已重新计算并保存个人资料。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法计算建议');
    }
  }

  async function applyRecommendation() {
    if (!recommendation || saving) return;
    setSaving(true);
    setMessage('正在保存训练日和休息日目标…');
    try {
      const warning = await applyGoals(recommendation.training, recommendation.rest);
      try {
        onApplied?.();
      } catch (refreshError) {
        console.error('目标已保存，但刷新目标表单失败', refreshError);
      }
      setMessage(warning
        ? `两种目标已保存，但当天目标同步出现警告：${warning}`
        : '建议已应用到训练日和休息日目标。你仍可在下方手动调整。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `应用建议失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="goal-recommendation panel">
      <div className="panel-title">
        <div><p className="eyebrow">个性化估算</p><h2>根据身体与训练情况生成建议</h2></div>
        <Sparkles size={21} />
      </div>

      <form onSubmit={calculate}>
        <div className="goal-profile-grid">
          <label>性别
            <select value={profile.sex} onChange={(event) => update('sex', event.target.value as GoalProfile['sex'])}>
              <option value="male">男性</option><option value="female">女性</option>
            </select>
          </label>
          <label>年龄
            <input type="number" min="14" max="100" value={profile.age} onChange={(event) => update('age', Number(event.target.value))} />
          </label>
          <label>身高 cm
            <input type="number" min="120" max="230" step="0.1" value={profile.heightCm} onChange={(event) => update('heightCm', Number(event.target.value))} />
          </label>
          <label>体重 kg
            <input type="number" min="30" max="300" step="0.1" value={profile.weightKg} onChange={(event) => update('weightKg', Number(event.target.value))} />
          </label>
          <label>活动量
            <select value={profile.activityLevel} onChange={(event) => update('activityLevel', event.target.value as GoalProfile['activityLevel'])}>
              {Object.entries(activityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label>目标
            <select value={profile.objective} onChange={(event) => update('objective', event.target.value as GoalProfile['objective'])}>
              {Object.entries(objectiveLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <button className="ghost" type="submit"><Calculator size={16} />重新计算</button>
      </form>

      {recommendation && (
        <>
          <div className="goal-recommendation-summary">
            {summary.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
          </div>
          <div className="goal-recommendation-macros">
            <div><strong>训练日</strong><span>蛋白质 {recommendation.training.protein}g · 碳水 {recommendation.training.carbs}g · 脂肪 {recommendation.training.fat}g</span></div>
            <div><strong>休息日</strong><span>蛋白质 {recommendation.rest.protein}g · 碳水 {recommendation.rest.carbs}g · 脂肪 {recommendation.rest.fat}g</span></div>
          </div>
          <button
            className="primary"
            type="button"
            disabled={saving}
            aria-busy={saving}
            onClick={() => void applyRecommendation()}
          >
            <Save size={16} />{saving ? '应用中…' : '应用到两种目标'}
          </button>
        </>
      )}

      {message && <p className="data-status" role="status" aria-live="polite">{message}</p>}
      <p className="goal-disclaimer">此结果是基于通用公式的起点估算，不是医疗或营养诊断。连续观察 2–3 周体重、训练表现和饥饿感后再调整。</p>
    </section>
  );
}
