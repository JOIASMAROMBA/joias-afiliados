export const BONUS_MILESTONES = [
  { target: 10, reward: 'R$50', rewardValue: 50, icon: '⭐' },
  { target: 20, reward: 'R$120', rewardValue: 120, icon: '🔥' },
  { target: 30, reward: 'R$200', rewardValue: 200, icon: '💎' },
  { target: 40, reward: 'R$300', rewardValue: 300, icon: '👑' },
  { target: 50, reward: 'R$500', rewardValue: 500, icon: '🚀' },
  { target: 100, reward: 'R$1.200', rewardValue: 1200, icon: '🏆' },
  { target: 200, reward: 'VIAGEM!', rewardValue: 10000, icon: '✈️' },
];

export function getCurrentMilestone(sales) {
  const idx = BONUS_MILESTONES.findIndex(m => sales < m.target);
  return idx === -1 ? BONUS_MILESTONES.length - 1 : idx;
}

export function getUnlockedMilestones(sales) {
  return BONUS_MILESTONES.filter(m => sales >= m.target);
}

export function getNextMilestone(sales) {
  return BONUS_MILESTONES.find(m => sales < m.target) || null;
}
