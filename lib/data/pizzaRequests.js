// Pizza-request generators — the domain entity in QuickPizza.
// Each request describes dietary restrictions; the API returns a generated pizza recommendation.
//
// Random draws go through lib/utils/random so SEED=<x> produces reproducible runs.

import { random, randInt, sample } from '../utils/random.js';

const COMMON_EXCLUDED = ['pepperoni', 'anchovies', 'pineapple', 'jalapenos'];
const COMMON_TOOLS = ['knife', 'scissors'];

// A realistic pizza request — mostly permissive, occasionally restrictive.
export function newPizzaRequest() {
  return {
    maxCaloriesPerSlice: randInt(400, 999),                      // 400–999
    mustBeVegetarian: random() < 0.25,                           // 25% vegetarian
    excludedIngredients: sample(COMMON_EXCLUDED, randInt(0, 2)),
    excludedTools: sample(COMMON_TOOLS, randInt(0, 1)),
    maxNumberOfToppings: randInt(4, 7),
    minNumberOfToppings: 2,
    customName: '',
  };
}

// A picky request — useful for tests that want to exercise the recommendation engine harder.
export function strictPizzaRequest() {
  return {
    maxCaloriesPerSlice: 300,
    mustBeVegetarian: true,
    excludedIngredients: COMMON_EXCLUDED,
    excludedTools: ['knife'],
    maxNumberOfToppings: 3,
    minNumberOfToppings: 2,
    customName: '',
  };
}

// Generate a star rating (weighted toward positive — most users who rate are satisfied).
export function newRating(pizzaId) {
  const weighted = [1, 2, 3, 4, 4, 5, 5, 5, 5];
  return {
    pizza_id: pizzaId,
    stars: weighted[Math.floor(random() * weighted.length)],
  };
}
