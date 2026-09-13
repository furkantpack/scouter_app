import * as Table from '@/components/ui/table';

export type ScoreSortDirection = 'asc' | 'desc';

export function SortableScoreHead({
  label,
  direction,
  active = true,
  onToggle,
}: {
  label: string;
  direction: ScoreSortDirection;
  active?: boolean;
  onToggle: () => void;
}) {
  return (
    <Table.Head aria-sort={active ? (direction === 'desc' ? 'descending' : 'ascending') : 'none'}>
      <button
        type='button'
        className='inline-flex items-center gap-1.5 whitespace-nowrap font-inherit text-inherit hover:text-text-strong-950'
        onClick={onToggle}
        aria-label={`${label}: ${active && direction === 'desc' ? 'highest first' : active ? 'lowest first' : 'sort highest first'}`}
      >
        {label}
        <span aria-hidden='true' className={active ? 'text-primary-base' : 'text-text-soft-400'}>
          {active ? (direction === 'desc' ? '↓' : '↑') : '↕'}
        </span>
      </button>
    </Table.Head>
  );
}
