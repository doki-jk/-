import { create } from 'zustand';
import { initialFoods } from '../data/mock';
import type { DailyGoal, FoodEntry } from '../types';
interface State { foods:FoodEntry[]; goal:DailyGoal; trainingDay:boolean; addFood:(food:FoodEntry)=>void; removeFood:(id:string)=>void; toggleTrainingDay:()=>void; }
export const useNutritionStore=create<State>((set)=>({foods:initialFoods,goal:{calories:2300,protein:170,carbs:260,fat:70},trainingDay:true,addFood:(food)=>set((s)=>({foods:[...s.foods,food]})),removeFood:(id)=>set((s)=>({foods:s.foods.filter((f)=>f.id!==id)})),toggleTrainingDay:()=>set((s)=>({trainingDay:!s.trainingDay}))}));
