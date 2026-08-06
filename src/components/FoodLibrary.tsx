import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Star, Trash2 } from 'lucide-react';
import {
  foodRepository,
  type CreateFoodInput,
  type Food,
  type FoodCategory,
} from '../repositories/foodRepository';
import { SmartFoodRecognition } from './SmartFoodRecognition';
import '../food-library.css';

const categories: FoodCategory[] = [
  '蛋白质来源',
  '主食',
  '水果',
  '蔬菜',
  '乳制品',
  '坚果',
  '补剂',
  '常见外食',
  '其他',
];

const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });

interface FoodLibraryProps {
  onRecordFood?: (food: Food) => void;
}

export function FoodLibrary({ onRecordFood }: FoodLibraryProps) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [keyword, setKeyword] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const result = favoritesOnly
        ? await foodRepository.getFavorites()
        : keyword.trim()
          ? await foodRepository.search(keyword)
          : await foodRepository.getAll();
      setFoods(result);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '读取食物库失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [keyword, favoritesOnly]);

  const summary = useMemo(() => ({
    total: foods.length,
    favorites: foods.filter((food) => food.isFavorite).length,
    custom: foods.filter((food) => food.isCustom).length,
  }), [foods]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input: CreateFoodInput = {
      name: String(form.get('name') ?? ''),
      category: String(form.get('category')) as FoodCategory,
      baseAmount: Number(form.get('baseAmount')),
      baseUnit: String(form.get('baseUnit') ?? 'g'),
      calories: Number(form.get('calories')),
      protein: Number(form.get('protein')),
      carbs: Number(form.get('carbs')),
      fat: Number(form.get('fat')),
      isCustom: true,
    };
    setSaving(true);
    setMessage('');
    try {
      await foodRepository.create(input);
      formElement.reset();
      await load();
      setMessage('自定义食物已保存到当前设备');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存食物失败');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFavorite(food: Food) {
    try {
      await foodRepository.toggleFavorite(food.id);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新收藏失败');
    }
  }

  async function remove(food: Food) {
    if (!food.isCustom || !confirm(`确定删除自定义食物“${food.name}”吗？`)) return;
    try {
      await foodRepository.remove(food.id);
      await load();
      setMessage('自定义食物已删除');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除食物失败');
    }
  }

  return (
    <section className="food-library-page">
      <div className="settings-heading">
        <p className="eyebrow">智能营养数据库</p>
        <h1>食物库</h1>
        <p>用自然语言识别食物和份量，也可以搜索、收藏或录入自己的营养数据。</p>
      </div>

      <div className="food-library-summary">
        <article><span>当前结果</span><strong>{summary.total}</strong></article>
        <article><span>当前结果中的收藏</span><strong>{summary.favorites}</strong></article>
        <article><span>当前结果中的自定义</span><strong>{summary.custom}</strong></article>
      </div>

      {onRecordFood && (
        <SmartFoodRecognition
          onApply={(result) => {
            onRecordFood({
              ...result.food,
              baseAmount: result.amount,
              baseUnit: result.unit,
              calories: result.nutrition.calories,
              protein: result.nutrition.protein,
              carbs: result.nutrition.carbs,
              fat: result.nutrition.fat,
            });
          }}
        />
      )}

      {message && <p className="data-status" role="status">{message}</p>}

      <div className="food-library-grid">
        <section className="panel food-list-panel">
          <div className="food-toolbar">
            <label>
              <Search size={17} />
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索鸡胸肉、米饭、香蕉…" />
            </label>
            <button type="button" className={favoritesOnly ? 'active' : ''} onClick={() => setFavoritesOnly((value) => !value)}>
              <Star size={16} />只看收藏
            </button>
          </div>

          {loading
            ? <p className="data-status">正在读取食物库…</p>
            : foods.length === 0
              ? <p className="empty-state">没有找到匹配的食物。</p>
              : (
                <div className="food-library-list">
                  {foods.map((food) => (
                    <article className="food-library-item" key={food.id}>
                      <div className="food-library-main">
                        <div>
                          <strong>{food.name}</strong>
                          <span>{food.category} · 每 {numberFormat.format(food.baseAmount)}{food.baseUnit}</span>
                        </div>
                        <b>{numberFormat.format(food.calories)} kcal</b>
                      </div>
                      <div className="food-library-macros">
                        <span>蛋白质 {numberFormat.format(food.protein)}g</span>
                        <span>碳水 {numberFormat.format(food.carbs)}g</span>
                        <span>脂肪 {numberFormat.format(food.fat)}g</span>
                      </div>
                      <div className="food-library-controls">
                        {onRecordFood && (
                          <button type="button" className="record-food" onClick={() => onRecordFood(food)}>
                            <Plus size={15} />记录到饮食
                          </button>
                        )}
                        <div className="food-library-icon-actions">
                          <button
                            type="button"
                            className={food.isFavorite ? 'favorite' : ''}
                            aria-label={food.isFavorite ? `取消收藏${food.name}` : `收藏${food.name}`}
                            title={food.isFavorite ? '取消收藏' : '收藏'}
                            onClick={() => void toggleFavorite(food)}
                          >
                            <Star size={17} fill={food.isFavorite ? 'currentColor' : 'none'} />
                          </button>
                          {food.isCustom && (
                            <button type="button" aria-label={`删除${food.name}`} title="删除自定义食物" onClick={() => void remove(food)}>
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
        </section>

        <form className="panel custom-food-form" onSubmit={submit}>
          <div className="panel-title">
            <div><p className="eyebrow">新建项目</p><h2>添加自定义食物</h2></div>
            <Plus size={20} />
          </div>
          <div className="goal-fields">
            <label>食物名称<input name="name" required placeholder="例如：自制鸡肉饭" /></label>
            <label>
              分类
              <select name="category" defaultValue="其他">
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>基准数量<input name="baseAmount" type="number" min="0.1" step="0.1" defaultValue="100" required /></label>
            <label>单位<input name="baseUnit" defaultValue="g" required /></label>
            <label>热量 kcal<input name="calories" type="number" min="0" step="0.1" required /></label>
            <label>蛋白质 g<input name="protein" type="number" min="0" step="0.1" defaultValue="0" required /></label>
            <label>碳水 g<input name="carbs" type="number" min="0" step="0.1" defaultValue="0" required /></label>
            <label>脂肪 g<input name="fat" type="number" min="0" step="0.1" defaultValue="0" required /></label>
          </div>
          <button className="primary" type="submit" disabled={saving}>
            <Plus size={16} />{saving ? '保存中…' : '保存到食物库'}
          </button>
        </form>
      </div>
    </section>
  );
}
