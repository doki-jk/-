import { AlertTriangle, Check, LoaderCircle, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  recognizeFoodText,
  type FoodRecognitionResult,
} from '../services/foodRecognition';
import '../smart-food.css';

const examples = ['200g鸡胸肉', '2个鸡蛋', '一碗米饭', '250ml牛奶', '1勺蛋白粉'];
const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });
const DIRECT_APPLY_THRESHOLD = 70;

interface SmartFoodRecognitionProps {
  onApply: (result: FoodRecognitionResult) => void;
}

export function SmartFoodRecognition({ onApply }: SmartFoodRecognitionProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FoodRecognitionResult | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; score: number }>>([]);
  const [error, setError] = useState('');

  async function recognize(value = query) {
    const normalized = value.trim();
    if (!normalized) {
      setError('请输入食物和份量。');
      setResult(null);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await recognizeFoodText(normalized);
      setResult(response.result);
      setSuggestions(response.suggestions.map((item) => ({ name: item.food.name, score: item.score })));
      setError(response.error ?? '');
    } catch (recognitionError) {
      setResult(null);
      setSuggestions([]);
      setError(recognitionError instanceof Error ? recognitionError.message : '识别失败，请重试。');
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await recognize();
  }

  function useExample(example: string) {
    setQuery(example);
    void recognize(example);
  }

  const safeToApply = Boolean(result && result.confidence >= DIRECT_APPLY_THRESHOLD);

  return (
    <section className="smart-food-card" aria-labelledby="smart-food-title">
      <div className="smart-food-heading">
        <div className="smart-food-icon"><Sparkles size={19} /></div>
        <div>
          <p className="eyebrow">本地食物匹配与份量估算</p>
          <h2 id="smart-food-title">一句话计算食物营养</h2>
          <p>输入“食物 + 份量”，自动匹配并估算热量、蛋白质、碳水和脂肪。</p>
        </div>
      </div>

      <form className="smart-food-form" onSubmit={submit}>
        <label>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例如：200g鸡胸肉、2个鸡蛋、一碗米饭"
            aria-label="描述食物和份量"
          />
        </label>
        <button className="primary" type="submit" disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
          {loading ? '识别中…' : '智能识别'}
        </button>
      </form>

      <div className="smart-food-examples" aria-label="识别示例">
        <span>试试：</span>
        {examples.map((example) => (
          <button type="button" key={example} onClick={() => useExample(example)}>{example}</button>
        ))}
      </div>

      {error && <p className="smart-food-error" role="alert">{error}</p>}

      {!result && suggestions.length > 0 && (
        <p className="smart-food-suggestions">
          可能相关：{suggestions.map((item) => `${item.name} ${numberFormat.format(item.score)}%`).join('、')}
        </p>
      )}

      {result && (
        <article className="smart-food-result">
          <div className="smart-food-result-title">
            <div>
              <span>识别为</span>
              <strong>{result.food.name} · {numberFormat.format(result.amount)}{result.unit}</strong>
            </div>
            <b className={`confidence confidence-${result.confidenceLabel}`}>
              置信度 {result.confidenceLabel} {numberFormat.format(result.confidence)}%
            </b>
          </div>

          <div className="smart-food-macros">
            <div><span>热量</span><strong>{numberFormat.format(result.nutrition.calories)}</strong><small>kcal</small></div>
            <div><span>蛋白质</span><strong>{numberFormat.format(result.nutrition.protein)}</strong><small>g</small></div>
            <div><span>碳水</span><strong>{numberFormat.format(result.nutrition.carbs)}</strong><small>g</small></div>
            <div><span>脂肪</span><strong>{numberFormat.format(result.nutrition.fat)}</strong><small>g</small></div>
          </div>

          <p className="smart-food-note">{result.note}</p>
          {!safeToApply && (
            <p className="smart-food-error" role="alert">
              <AlertTriangle size={15} />置信度低于 {DIRECT_APPLY_THRESHOLD}%，为避免记错数据，请修改描述或改用手动录入。
            </p>
          )}
          <button
            className="record-food smart-food-apply"
            type="button"
            disabled={!safeToApply}
            onClick={() => safeToApply && onApply(result)}
          >
            <Check size={16} />{safeToApply ? '使用识别结果并记录' : '低置信度，暂不可记录'}
          </button>
        </article>
      )}
    </section>
  );
}
