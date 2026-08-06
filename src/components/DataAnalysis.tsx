import { useEffect, useMemo, useState } from 'react';
import { Activity, Flame, Scale, Utensils } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsRepository, type DailyNutritionPoint } from '../repositories/analyticsRepository';
import { bodyRecordRepository, type BodyRecord } from '../repositories/bodyRecordRepository';
import '../analysis.css';

const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });

export function DataAnalysis() {
  const [nutrition, setNutrition] = useState<DailyNutritionPoint[]>([]);
  const [bodyRecords, setBodyRecords] = useState<BodyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [nutritionPoints, records] = await Promise.all([
          analyticsRepository.getLastSevenDays(),
          bodyRecordRepository.getAll(),
        ]);
        if (active) {
          setNutrition(nutritionPoints);
          setBodyRecords(records.slice(0, 30).reverse());
          setMessage('');
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : '读取分析数据失败');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => {
    const recordedDays = nutrition.filter((item) => item.calories > 0);
    const divisor = recordedDays.length || 1;
    const totalCalories = recordedDays.reduce((sum, item) => sum + item.calories, 0);
    const totalProtein = recordedDays.reduce((sum, item) => sum + item.protein, 0);
    const latestWeight = bodyRecords.length > 0 ? bodyRecords[bodyRecords.length - 1].weight : null;
    const firstWeight = bodyRecords[0]?.weight ?? null;
    const weightChange = latestWeight != null && firstWeight != null ? latestWeight - firstWeight : null;
    return {
      averageCalories: totalCalories / divisor,
      averageProtein: totalProtein / divisor,
      recordedDays: recordedDays.length,
      latestWeight,
      weightChange,
    };
  }, [nutrition, bodyRecords]);

  const nutritionChart = nutrition.map((item) => ({
    date: item.date.slice(5),
    calories: item.calories,
    protein: item.protein,
  }));
  const weightChart = bodyRecords.map((item) => ({ date: item.recordedDate.slice(5), weight: item.weight }));

  return (
    <section className="analysis-page">
      <div className="settings-heading">
        <p className="eyebrow">趋势与复盘</p>
        <h1>数据分析</h1>
        <p>根据当前设备中保存的饮食与身体记录，查看最近趋势和记录完整度。日均值仅按实际有记录的天数计算。</p>
      </div>

      {message && <p className="data-status" role="status">{message}</p>}
      {loading ? <p className="data-status">正在整理分析数据…</p> : (
        <>
          <div className="analysis-summary-grid">
            <article className="analysis-summary-card"><Flame size={20} /><span>有记录日均热量</span><strong>{numberFormat.format(summary.averageCalories)} kcal</strong></article>
            <article className="analysis-summary-card"><Utensils size={20} /><span>有记录日均蛋白质</span><strong>{numberFormat.format(summary.averageProtein)} g</strong></article>
            <article className="analysis-summary-card"><Activity size={20} /><span>有记录天数</span><strong>{summary.recordedDays} / 7 天</strong></article>
            <article className="analysis-summary-card"><Scale size={20} /><span>最新体重</span><strong>{summary.latestWeight == null ? '--' : `${numberFormat.format(summary.latestWeight)} kg`}</strong><small>{summary.weightChange == null ? '至少记录两次后显示变化' : `较首条 ${summary.weightChange > 0 ? '+' : ''}${numberFormat.format(summary.weightChange)} kg`}</small></article>
          </div>

          <div className="analysis-grid">
            <section className="panel analysis-chart-card">
              <div className="panel-title"><div><p className="eyebrow">最近 7 天</p><h2>热量与蛋白质</h2></div></div>
              <div className="analysis-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={nutritionChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} width={38} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} width={32} />
                    <Tooltip />
                    <Area yAxisId="left" type="monotone" dataKey="calories" name="热量 kcal" stroke="currentColor" fill="currentColor" fillOpacity={0.14} strokeWidth={3} />
                    <Line yAxisId="right" type="monotone" dataKey="protein" name="蛋白质 g" stroke="currentColor" strokeWidth={2} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="panel analysis-chart-card">
              <div className="panel-title"><div><p className="eyebrow">最近 30 条</p><h2>体重趋势</h2></div></div>
              {weightChart.length === 0 ? <p className="empty-state">还没有身体数据，先到“身体数据”页面记录体重。</p> : (
                <div className="analysis-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightChart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} />
                      <YAxis domain={['dataMin - 2', 'dataMax + 2']} axisLine={false} tickLine={false} width={42} />
                      <Tooltip formatter={(value) => [`${numberFormat.format(Number(value))} kg`, '体重']} />
                      <Line type="monotone" dataKey="weight" stroke="currentColor" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
