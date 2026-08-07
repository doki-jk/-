use std::collections::HashSet;

use serde::Deserialize;
use sqlx::Executor;
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

const DATABASE_KEY: &str = "sqlite:fuellog.db";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreData {
    foods: Vec<Food>,
    meals: Vec<Meal>,
    goals: Goals,
    body_records: Vec<BodyRecord>,
    daily_plans: Vec<DailyPlan>,
    profile: Profile,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Food {
    id: String,
    name: String,
    category: String,
    base_amount: f64,
    base_unit: String,
    calories: f64,
    protein: f64,
    carbs: f64,
    fat: f64,
    is_favorite: bool,
    is_custom: bool,
    usage_count: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Meal {
    id: String,
    food_id: Option<String>,
    food_name: String,
    meal_type: String,
    consumed_at: String,
    amount: f64,
    unit: String,
    calories: f64,
    protein: f64,
    carbs: f64,
    fat: f64,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
struct Goals {
    training: Goal,
    rest: Goal,
}

#[derive(Deserialize)]
struct Goal {
    calories: f64,
    protein: f64,
    carbs: f64,
    fat: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BodyRecord {
    id: String,
    recorded_date: String,
    weight: f64,
    body_fat: Option<f64>,
    muscle_mass: Option<f64>,
    waist: Option<f64>,
    note: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DailyPlan {
    date: String,
    day_type: String,
    goal: Goal,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Profile {
    sex: String,
    age: i64,
    height_cm: f64,
    weight_kg: f64,
    activity_level: String,
    objective: String,
}

fn require_text(value: &str, label: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("{label}不能为空"))
    } else {
        Ok(())
    }
}

fn require_nonnegative(value: f64, label: &str) -> Result<(), String> {
    if value.is_finite() && value >= 0.0 {
        Ok(())
    } else {
        Err(format!("{label}数值无效"))
    }
}

fn require_positive(value: f64, label: &str) -> Result<(), String> {
    if value.is_finite() && value > 0.0 {
        Ok(())
    } else {
        Err(format!("{label}数值无效"))
    }
}

fn validate_goal(goal: &Goal, label: &str) -> Result<(), String> {
    require_positive(goal.calories, &format!("{label}热量"))?;
    require_nonnegative(goal.protein, &format!("{label}蛋白质"))?;
    require_nonnegative(goal.carbs, &format!("{label}碳水"))?;
    require_nonnegative(goal.fat, &format!("{label}脂肪"))?;
    Ok(())
}

fn validate_backup(backup: &RestoreData) -> Result<(), String> {
    let categories = [
        "蛋白质来源", "主食", "水果", "蔬菜", "乳制品", "坚果", "补剂", "常见外食", "其他",
    ];
    let meal_types = ["早餐", "午餐", "晚餐", "加餐"];
    let mut food_ids = HashSet::new();
    for food in &backup.foods {
        require_text(&food.id, "食物 ID")?;
        require_text(&food.name, "食物名称")?;
        require_text(&food.base_unit, "食物单位")?;
        if !categories.contains(&food.category.as_str()) {
            return Err("食物分类无效".into());
        }
        require_positive(food.base_amount, "食物基准数量")?;
        require_nonnegative(food.calories, "食物热量")?;
        require_nonnegative(food.protein, "食物蛋白质")?;
        require_nonnegative(food.carbs, "食物碳水")?;
        require_nonnegative(food.fat, "食物脂肪")?;
        if food.usage_count < 0 {
            return Err("食物使用次数无效".into());
        }
        require_text(&food.created_at, "食物创建时间")?;
        require_text(&food.updated_at, "食物更新时间")?;
        if !food_ids.insert(food.id.as_str()) {
            return Err("食物数据包含重复标识".into());
        }
    }

    let mut meal_ids = HashSet::new();
    for meal in &backup.meals {
        require_text(&meal.id, "饮食 ID")?;
        require_text(&meal.food_name, "饮食名称")?;
        require_text(&meal.unit, "饮食单位")?;
        if !meal_types.contains(&meal.meal_type.as_str()) {
            return Err("饮食餐次无效".into());
        }
        if let Some(food_id) = meal.food_id.as_deref() {
            if !food_ids.contains(food_id) {
                return Err("饮食引用了不存在的食物".into());
            }
        }
        require_positive(meal.amount, "饮食数量")?;
        require_nonnegative(meal.calories, "饮食热量")?;
        require_nonnegative(meal.protein, "饮食蛋白质")?;
        require_nonnegative(meal.carbs, "饮食碳水")?;
        require_nonnegative(meal.fat, "饮食脂肪")?;
        require_text(&meal.consumed_at, "饮食时间")?;
        require_text(&meal.created_at, "饮食创建时间")?;
        require_text(&meal.updated_at, "饮食更新时间")?;
        if !meal_ids.insert(meal.id.as_str()) {
            return Err("饮食数据包含重复标识".into());
        }
    }

    validate_goal(&backup.goals.training, "训练日目标")?;
    validate_goal(&backup.goals.rest, "休息日目标")?;

    let mut body_ids = HashSet::new();
    let mut body_dates = HashSet::new();
    for record in &backup.body_records {
        require_text(&record.id, "身体数据 ID")?;
        require_text(&record.recorded_date, "身体数据日期")?;
        require_positive(record.weight, "体重")?;
        if let Some(value) = record.body_fat {
            require_nonnegative(value, "体脂率")?;
            if value > 100.0 {
                return Err("体脂率不能超过 100".into());
            }
        }
        if let Some(value) = record.muscle_mass {
            require_nonnegative(value, "肌肉量")?;
        }
        if let Some(value) = record.waist {
            require_nonnegative(value, "腰围")?;
        }
        require_text(&record.created_at, "身体数据创建时间")?;
        require_text(&record.updated_at, "身体数据更新时间")?;
        if !body_ids.insert(record.id.as_str()) || !body_dates.insert(record.recorded_date.as_str()) {
            return Err("身体数据包含重复标识或日期".into());
        }
    }

    let mut plan_dates = HashSet::new();
    for plan in &backup.daily_plans {
        require_text(&plan.date, "每日计划日期")?;
        if plan.day_type != "training" && plan.day_type != "rest" {
            return Err("每日计划类型无效".into());
        }
        validate_goal(&plan.goal, "每日计划目标")?;
        require_text(&plan.updated_at, "每日计划更新时间")?;
        if !plan_dates.insert(plan.date.as_str()) {
            return Err("每日计划包含重复日期".into());
        }
    }

    let profile = &backup.profile;
    if profile.sex != "male" && profile.sex != "female" {
        return Err("个人资料性别无效".into());
    }
    if !(14..=100).contains(&profile.age) {
        return Err("个人资料年龄无效".into());
    }
    if !profile.height_cm.is_finite() || !(120.0..=230.0).contains(&profile.height_cm) {
        return Err("个人资料身高无效".into());
    }
    if !profile.weight_kg.is_finite() || !(30.0..=300.0).contains(&profile.weight_kg) {
        return Err("个人资料体重无效".into());
    }
    if !["sedentary", "light", "moderate", "high"].contains(&profile.activity_level.as_str()) {
        return Err("个人资料活动量无效".into());
    }
    if !["cut", "maintain", "gain"].contains(&profile.objective.as_str()) {
        return Err("个人资料目标无效".into());
    }
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn restore_backup_atomic(
    db_instances: State<'_, DbInstances>,
    backup: RestoreData,
    restored_at: String,
) -> Result<(), String> {
    validate_backup(&backup)?;
    require_text(&restored_at, "恢复时间")?;

    let instances = db_instances.0.read().await;
    let db = instances
        .get(DATABASE_KEY)
        .ok_or_else(|| "FuelLog SQLite 尚未加载".to_string())?;
    let pool = match db {
        DbPool::Sqlite(pool) => pool,
        #[allow(unreachable_patterns)]
        _ => return Err("FuelLog 数据库类型无效".into()),
    };

    let mut tx = pool.begin().await.map_err(|error| error.to_string())?;

    for table in [
        "meal_entries",
        "daily_plans",
        "body_records",
        "nutrition_goals",
        "user_profile",
        "foods",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
    }

    for food in &backup.foods {
        sqlx::query(
            "INSERT INTO foods(id,name,category,base_amount,base_unit,calories,protein,carbs,fat,is_favorite,is_custom,usage_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(&food.id)
        .bind(&food.name)
        .bind(&food.category)
        .bind(food.base_amount)
        .bind(&food.base_unit)
        .bind(food.calories)
        .bind(food.protein)
        .bind(food.carbs)
        .bind(food.fat)
        .bind(i64::from(food.is_favorite))
        .bind(i64::from(food.is_custom))
        .bind(food.usage_count)
        .bind(&food.created_at)
        .bind(&food.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    for (day_type, goal) in [
        ("training", &backup.goals.training),
        ("rest", &backup.goals.rest),
    ] {
        sqlx::query(
            "INSERT INTO nutrition_goals(id,goal_type,day_type,calories,protein,carbs,fat,effective_from,effective_to,created_at) VALUES (?, 'daily_macro', ?, ?, ?, ?, ?, ?, NULL, ?)",
        )
        .bind(format!("restore-{day_type}"))
        .bind(day_type)
        .bind(goal.calories)
        .bind(goal.protein)
        .bind(goal.carbs)
        .bind(goal.fat)
        .bind(&restored_at)
        .bind(&restored_at)
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    let profile = &backup.profile;
    sqlx::query(
        "INSERT INTO user_profile(id,sex,age,height_cm,weight_kg,activity_level,objective,updated_at) VALUES (1,?,?,?,?,?,?,?)",
    )
    .bind(&profile.sex)
    .bind(profile.age)
    .bind(profile.height_cm)
    .bind(profile.weight_kg)
    .bind(&profile.activity_level)
    .bind(&profile.objective)
    .bind(&restored_at)
    .execute(&mut *tx)
    .await
    .map_err(|error| error.to_string())?;

    for record in &backup.body_records {
        sqlx::query(
            "INSERT INTO body_records(id,recorded_date,weight,body_fat,muscle_mass,waist,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(&record.id)
        .bind(&record.recorded_date)
        .bind(record.weight)
        .bind(record.body_fat)
        .bind(record.muscle_mass)
        .bind(record.waist)
        .bind(&record.note)
        .bind(&record.created_at)
        .bind(&record.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    for meal in &backup.meals {
        sqlx::query(
            "INSERT INTO meal_entries(id,food_id,food_name,meal_type,consumed_at,amount,unit,calories,protein,carbs,fat,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(&meal.id)
        .bind(&meal.food_id)
        .bind(&meal.food_name)
        .bind(&meal.meal_type)
        .bind(&meal.consumed_at)
        .bind(meal.amount)
        .bind(&meal.unit)
        .bind(meal.calories)
        .bind(meal.protein)
        .bind(meal.carbs)
        .bind(meal.fat)
        .bind(&meal.created_at)
        .bind(&meal.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    for plan in &backup.daily_plans {
        sqlx::query(
            "INSERT INTO daily_plans(date,day_type,calories,protein,carbs,fat,updated_at) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(&plan.date)
        .bind(&plan.day_type)
        .bind(plan.goal.calories)
        .bind(plan.goal.protein)
        .bind(plan.goal.carbs)
        .bind(plan.goal.fat)
        .bind(&plan.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    tx.commit().await.map_err(|error| error.to_string())
}
