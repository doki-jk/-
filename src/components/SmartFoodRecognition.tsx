import { AlertTriangle, Check, LoaderCircle, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { Food } from '../repositories/foodRepository';
import {
  confirmFoodSuggestion,
  recognizeFoodBatchText,
  type FoodRecognitionResult,
} from '../services/foodRecognition';
import '../smart-food.css';

const examples = ['200g鸡胸肉', '2个鸡蛋', '一碗米饭', '250ml牛奶', '200g鸡胸肉 + 一碗米饭'];
const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });
const DIRECT_APPLY_THRESHOLD = 70;

type RecognitionItem = {
  text: string;
  result: FoodRecognitionResult | null;
  suggestions: Array<{ food: Food; score: number }>;
  error: string;
};

interface SmartFoodRecognitionProps {
  onApply: (result: FoodRecognitionResult) => void;
}

export function SmartFoodRecognition({ onApply }: SmartFoodRecognitionProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RecognitionItem[]>([]);
  const [error, setError] = useState('');
  const [batchMode, setBatchMode] = useState(false);

  async function recognize(value = query) {
    const normalized = value.trim();
    if (!normalized) {
      setError('请输入食物和份量。');
      setItems([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await recognizeFoodBatchText(normalized);
      setBatchMode(response.isBatch);
      setItems(response.items.map((item) => ({
        text: item.text,
        result: item.response.result,
        suggestions: item.response.suggestions,
        error: item.response.error ?? '',
      })));
      setError(response.error ?? '');
    } catch (recognitionError) {
      setItems([]);
      setBatchMode(false);
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

  async function selectSuggestion(index: number, food: Food) {
    try {
      const selected = await confirmFoodSuggestion(items[index].text, food);
      setItems((current) => current.map((item, itemIndex) => itemIndex === index
        ? { ...item, result: selected, error: '' }
        : item));
    } catch (selectionError) {
      setItems((current) => current.map((item, itemIndex) => itemIndex === index
        ? { ...item, error: selectionError instanceof Error ? selectionError.message : '候选确认失败' }
        : item));
    }
  }

  return (
    <section className="smart-food-card" aria-labelledby="smart-food-title">
      <div className="smart-food-heading">
        <div className="smart-food-icon"><Sparkles size={19} /></div>
        <div>
          <p className="eyebrow">本地食物匹配与份量估算</p>
          <h2 id="smart-food-title">一句话计算食物营养</h2>
          <p>输入一个或多个“食物 + 份量”，用逗号、顿号、加号或“和”分隔。</p>
        </div>
      </div>

      <form className="smart-food-form" onSubmit={submit}>
        <label>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例如：200g鸡胸肉 + 一碗米饭"
            aria-label="描述一个或多个食物和份量"
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
      {batchMode && items.length > 0 && <p className="smart-food-suggestions">已拆分为 {items.length} 个食物，请逐项确认并记录。</p>}

      <div className={batchMode ? 'smart-food-result-list' : undefined}>
        {items.map((item, index) => {
          const result = item.result;
          const safeToApply = Boolean(result && result.confidence >= DIRECT_APPLY_THRESHOLD);
          return (
            <article className="smart-food-result" key={`${item.text}-${index}`}>
              {batchMode && <p className="smart-food-segment">原始片段：{item.text}</p>}

              {result ? (
                <>
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
                      <AlertTriangle size={15} />匹配置信度不足。请选择下方候选确认食物，或改用手动录入。
                    </p>
                  )}
                </>
              ) : item.error ? <p className="smart-food-error" role="alert">{item.error}</p> : null}

              {item.suggestions.length > 0 && (!safeToApply || !result) && (
                <div className="smart-food-candidates" aria-label={`${item.text}的候选食物`}>
                  <span>选择候选：</span>
                  {item.suggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion.food.id}
                      onClick={() => void selectSuggestion(index, suggestion.food)}
                    >
                      {suggestion.food.name} {numberFormat.format(suggestion.score)}%
                    </button>
                  ))}
                </div>
              )}

              {result && (
                <button
                  className="record-food smart-food-apply"
                  type="button"
                  disabled={!safeToApply}
                  onClick={() => safeToApply && onApply(result)}
                >
                  <Check size={16} />{safeToApply ? '使用这项结果并记录' : '确认候选后才能记录'}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
