export type ProgramMetadata = { id: string; name: string; region: string; archetype: string; logoDomain?: string };

export const PROGRAMS: ProgramMetadata[] = [
  { id: 'yc', name: 'Y Combinator', region: 'US / Global', archetype: 'Fast-moving founders building venture-scale companies with small teams that ship and learn quickly.', logoDomain: 'ycombinator.com' },
  { id: 'techstars', name: 'Techstars', region: 'US / Global', archetype: 'Strong teams with commercial execution, domain fit, and mentor or corporate leverage.', logoDomain: 'techstars.com' },
  { id: '500_global', name: '500 Global Flagship', region: 'US / Global', archetype: 'Early-stage teams showing product-market learning, growth discipline, and cross-border potential.', logoDomain: '500.co' },
  { id: 'speedrun', name: 'a16z speedrun', region: 'US / Global', archetype: 'Zero-to-one teams with agency, rapid execution, product-building ability, and market validation.' },
  { id: 'sequoia_capital', name: 'Sequoia Capital', region: 'US / Europe / Global', archetype: 'Outlier founders with category-defining insight, technical excellence, durable PMF, and global ambition.', logoDomain: 'sequoiacap.com' },
  { id: 'sequoia_arc', name: 'Sequoia Arc', region: 'US / Europe / Global', archetype: 'Small cohorts centered on founder quality, customer insight, PMF, team design, and speed.', logoDomain: 'sequoiacap.com' },
  { id: 'hf0', name: 'HF0', region: 'US / Global', archetype: 'Ultra-small residency favoring repeat founders or breakout teams with exceptional traction and velocity.' },
  { id: 'spc', name: 'South Park Commons Founder Fellowship', region: 'US / Global', archetype: 'Founder-first program for ambitious technologists with depth, builder ability, and long-horizon ambition.' },
  { id: 'neo', name: 'Neo Residency', region: 'US / Global', archetype: 'Technical talent residency for young builders, student founders, and high-velocity pre-seed teams.' },
  { id: 'pearx', name: 'PearX', region: 'US / Global', archetype: 'Small-batch pre-seed accelerator emphasizing rapid learning, customer insight, and shipping.' },
  { id: 'alchemist', name: 'Alchemist Accelerator', region: 'US / Global', archetype: 'Enterprise-first accelerator for technical founders commercializing B2B software and deep tech.' },
  { id: 'ef', name: 'Entrepreneurs First', region: 'Europe / SF bridge / Global', archetype: 'Founder-first talent investing before a fixed company, cofounder, or idea.' },
  { id: 'antler', name: 'Antler', region: 'Global', archetype: 'Day-zero investor for domain operators and builders with early evidence of commercial pull.' },
  { id: 'seedcamp', name: 'Seedcamp', region: 'Europe / Global', archetype: 'Day-one fund favoring high-margin software, global ambition, and fast time-to-market.' },
  { id: 'ewor', name: 'EWOR', region: 'Europe / Global', archetype: 'Founder fellowship for globally ambitious technical, research, and repeat-founder profiles.' },
  { id: 'hub71', name: 'Hub71', region: 'MENA / Global', archetype: 'Market-ready startups using Abu Dhabi as a commercial expansion base.' },
  { id: 'sanabil_500', name: 'Sanabil Accelerator by 500 Global', region: 'MENA', archetype: 'MENA-focused teams with MVP, early traction, and regional scaling ambition.' },
  { id: 'flat6labs', name: 'Flat6Labs', region: 'MENA / Africa', archetype: 'Early-stage teams with local-market relevance, commercialization potential, and ecosystem fit.' },
  { id: 'platanus', name: 'Platanus Ventures', region: 'LatAm', archetype: 'Technical Latin American founders with product velocity and ambitious software.' },
  { id: 'latitud', name: 'Latitud Fellowship', region: 'LatAm / SF bridge', archetype: 'Pre-founder fellowship for globally ambitious Latin American operators and builders.' },
  { id: 'startup_chile', name: 'Start-Up Chile BIG', region: 'LatAm / Global', archetype: 'Scalable tech and science ventures using Chile as a launch or expansion base.' },
];

export const PROGRAM_BY_ID = new Map(PROGRAMS.map((program) => [program.id, program]));
