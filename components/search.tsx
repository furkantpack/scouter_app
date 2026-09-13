'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiBriefcase4Line,
  RiCloseLine,
  RiCornerDownLeftLine,
  RiLayoutGridLine,
  RiLinksLine,
  RiRocket2Line,
  RiSearch2Line,
  RiSparklingLine,
} from '@remixicon/react';
import { atom, useAtom, useSetAtom } from 'jotai';

import { cn } from '@/utils/cn';
import * as CommandMenu from '@/components/ui/command-menu';
import * as CompactButton from '@/components/ui/compact-button';
import * as Kbd from '@/components/ui/kbd';
import * as LinkButton from '@/components/ui/link-button';
import * as Tag from '@/components/ui/tag';
import * as TopbarItemButton from '@/components/topbar-item-button';

import IconCmd from '~/icons/icon-cmd.svg';

const isCommandMenuOpen = atom(false);

export function SearchMenuButton({
  ...rest
}: React.ComponentPropsWithoutRef<typeof TopbarItemButton.Root>) {
  const setOpen = useSetAtom(isCommandMenuOpen);

  return (
    <>
      <TopbarItemButton.Root onClick={() => setOpen(true)} {...rest}>
        <TopbarItemButton.Icon as={RiSearch2Line} />
      </TopbarItemButton.Root>
    </>
  );
}

export function SearchMenu() {
  const [open, setOpen] = useAtom(isCommandMenuOpen);
  const router = useRouter();

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <CommandMenu.Dialog open={open} onOpenChange={setOpen}>
      <CommandMenu.DialogTitle className='sr-only'>
        Search Menu
      </CommandMenu.DialogTitle>
      <CommandMenu.DialogDescription className='sr-only'>
        This command menu allows you to quickly access features and navigate
        through different sections by typing relevant commands.
      </CommandMenu.DialogDescription>
      {/* Input wrapper */}
      <div className='group/cmd-input flex h-12 w-full items-center gap-2 bg-bg-white-0 px-5'>
        <RiSearch2Line
          className={cn(
            'size-5 shrink-0 text-text-soft-400',
            'transition duration-200 ease-out',
            // focus within
            'group-focus-within/cmd-input:text-primary-base',
          )}
        />
        <CommandMenu.Input placeholder='Search Scouter or jump to' />
        <Kbd.Root>
          <IconCmd className='size-2.5' />K
        </Kbd.Root>
        <CompactButton.Root
          size='medium'
          variant='ghost'
          onClick={() => setOpen(false)}
        >
          <CompactButton.Icon as={RiCloseLine} />
        </CompactButton.Root>
      </div>

      {/* Searching for */}
      <div className='px-5 py-4'>
        <div className='mb-3 text-label-xs text-text-sub-600'>
          Searching for
        </div>
        <div className='flex flex-wrap gap-2'>
          <Tag.Root variant='gray'>
            Founders
            <Tag.DismissButton type='button' />
          </Tag.Root>
          <Tag.Root variant='gray'>
            Portfolio
            <Tag.DismissButton type='button' />
          </Tag.Root>
          <Tag.Root variant='gray'>
            Programs
            <Tag.DismissButton type='button' />
          </Tag.Root>
          <Tag.Root variant='gray'>
            Network
            <Tag.DismissButton type='button' />
          </Tag.Root>
          <Tag.Root variant='gray'>
            Lists
            <Tag.DismissButton type='button' />
          </Tag.Root>
        </div>
      </div>

      {/* Smart Prompt Examples */}
      <CommandMenu.List>
        <CommandMenu.Group heading='Scouter Recommendations'>
          <CommandMenu.Item onSelect={() => navigate('/all-founders')}>
            <CommandMenu.ItemIcon as={RiSparklingLine} />
            Discover founders matching your investment focus
          </CommandMenu.Item>
          <CommandMenu.Item onSelect={() => navigate('/portf%C3%B6y')}>
            <CommandMenu.ItemIcon as={RiSparklingLine} />
            Review your strongest portfolio signals
          </CommandMenu.Item>
          <CommandMenu.Item onSelect={() => navigate('/programs')}>
            <CommandMenu.ItemIcon as={RiSparklingLine} />
            Find programs aligned with your strategy
          </CommandMenu.Item>
          <CommandMenu.Item onSelect={() => navigate('/network')}>
            <CommandMenu.ItemIcon as={RiSparklingLine} />
            Explore warm paths across your network
          </CommandMenu.Item>
        </CommandMenu.Group>
        <CommandMenu.Group heading='Results (4)'>
          <LinkButton.Root
            size='small'
            variant='gray'
            className='absolute right-4 top-5'
          >
            See All
          </LinkButton.Root>
          <CommandMenu.Item onSelect={() => navigate('/dashboard')}>
            <CommandMenu.ItemIcon as={RiLayoutGridLine} />
            Open Founder Intelligence dashboard
          </CommandMenu.Item>
          <CommandMenu.Item onSelect={() => navigate('/all-founders')}>
            <CommandMenu.ItemIcon as={RiRocket2Line} />
            Browse top founders
          </CommandMenu.Item>
          <CommandMenu.Item onSelect={() => navigate('/funded')}>
            <CommandMenu.ItemIcon as={RiBriefcase4Line} />
            Review funded companies
          </CommandMenu.Item>
          <CommandMenu.Item onSelect={() => navigate('/network')}>
            <CommandMenu.ItemIcon as={RiLinksLine} />
            Open Network Mode
          </CommandMenu.Item>
        </CommandMenu.Group>
      </CommandMenu.List>

      {/* Footer */}
      <CommandMenu.Footer>
        <div className='hidden gap-3 md:flex'>
          <div className='flex items-center gap-2'>
            <CommandMenu.FooterKeyBox>
              <RiArrowUpLine className='size-4' />
            </CommandMenu.FooterKeyBox>
            <CommandMenu.FooterKeyBox>
              <RiArrowDownLine className='size-4' />
            </CommandMenu.FooterKeyBox>
            <span className='text-paragraph-xs text-text-sub-600'>
              Navigate
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <CommandMenu.FooterKeyBox>
              <RiCornerDownLeftLine className='size-4' />
            </CommandMenu.FooterKeyBox>
            <span className='text-paragraph-xs text-text-sub-600'>Select</span>
          </div>
        </div>

        <div className='text-right text-paragraph-xs text-text-sub-600'>
          Tip: search by founder, company, sector, program, or network signal.
        </div>
      </CommandMenu.Footer>
    </CommandMenu.Dialog>
  );
}
