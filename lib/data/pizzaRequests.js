// Pizza-request generators — the domain entity in QuickPizza.
// Each request describes dietary restrictions; the API returns a generated pizza recommendation.

const COMMON_EXCLUDED = ['pepperoni', 'anchovies', 'pineapple', 'jalapenos'];
const COMMON_TOOLS = ['knife', 'scissors'];

function pickSome(arr, max = 2) {
  const n = Math.floor(Math.random() * (max + 1));
  return arr.slice().sort(() => Math.random() - 0.5).slice(0, n);
}

// A realistic pizza request — mostly permissive, occasionally restrictive.
export function newPizzaRequest() {
  return {
    maxCaloriesPerSlice: 400 + Math.floor(Math.random() * 600),  // 400–1000
    mustBeVegetarian: Math.random() < 0.25,                      // 25% vegetarian
    excludedIngredients: pickSome(COMMON_EXCLUDED, 2),
    excludedTools: pickSome(COMMON_TOOLS, 1),
    maxNumberOfToppings: 4 + Math.floor(Math.random() * 4),      // 4–7
    minNumberOfToppings: 2,
    customName: '',
  };
}

// Generate a star rating (weighted toward positive — most users who rate are satisfied).
export function newRating(pizzaId) {
  const weighted = [1, 2, 3, 4, 4, 5, 5, 5, 5];
  return {
    pizza_id: pizzaId,
    stars: weighted[Math.floor(Math.random() * weighted.length)],
  };
}
