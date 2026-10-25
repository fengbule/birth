export const AUTO_READING_MS = 3000;
export function yearInterval(duration, life, speed = 1) {
  return duration * 60000 / life / speed;
}

export function focusOptions(s) {
  if (s.age < 18) return [
    ['study','读书','知识 ↑ · 幸福略降'],
    ['connection','朋友 · 玩耍','关系 ↑ · 幸福 ↑'],
    ['help','帮忙家里','家人 ↑ · 学习时间略少'],
    ['health','运动','健康 ↑'],
    ['rest','兴趣','幸福 ↑ · 兴趣渐渐熟练'],
  ].filter(([key])=>key!=='study'||s.education!=='未曾上学');
  if (s.education === '大学在读') return [
    ['study','读书','知识与学业'],['connection','朋友 · 玩耍','关系与幸福'],
    ['work','打工','收入与经验'],['jobprep','求职准备','为工作机会做准备'],
    ['health','运动','健康与恢复'],['rest','兴趣','快乐与兴趣'],
  ];
  if (/家管|家庭照顾|全职照顾/.test(s.occupation)) return [
    ['connection','家人与朋友','陪伴与关系'],['health','健康管理','运动与恢复'],
    ['study','自我成长','学习与机会'],['help','照顾家里','家人的日常生活'],
    ['rest','兴趣与休息','为自己留一点时间'],
  ];
  return [
    ['work','专注工作','收入与职业经验'],['connection','家人与朋友','陪伴与关系'],
    ['health','健康管理','运动与恢复'],['study','自我成长','学习与机会'],
    ['rest','兴趣与休息','快乐与兴趣'],['balanced','保持平衡','照顾生活的不同方面'],
  ];
}

export function autoChoiceIndex(s, decision, draw) {
  const count = decision?.choices?.length || 0;
  if (!count) return null;
  if (s.focus === 'study') return 0;
  if (s.focus === 'connection') return Math.min(1,count-1);
  return Math.min(count-1,Math.floor(draw()*count));
}
