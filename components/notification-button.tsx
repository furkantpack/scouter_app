'use client';

import {
  RiContractRightLine,
  RiFilter3Fill,
  RiNotification3Line,
  RiSettings2Line,
} from '@remixicon/react';

import * as Avatar from '@/components/ui/avatar';
import * as Badge from '@/components/ui/badge';
import * as CompactButton from '@/components/ui/compact-button';
import * as Divider from '@/components/ui/divider';
import * as LinkButton from '@/components/ui/link-button';
import * as Popover from '@/components/ui/popover';
import * as TabMenuHorizontal from '@/components/ui/tab-menu-horizontal';
import * as TopbarItemButton from '@/components/topbar-item-button';

type NotificationCategory = 'inbox' | 'following' | 'archived';

type Notification = {
  id: string;
  category: NotificationCategory;
  actor: string;
  message: string;
  context: string;
  time: string;
  avatar: string;
  contextIcon?: string;
  unread?: boolean;
};

// This will be populated by the product notification source when connected.
// Keeping it data-driven prevents template activity from appearing to users.
const notifications: Notification[] = [];

function EmptyNotifications() {
  return (
    <div className='flex min-h-64 flex-col items-center justify-center px-8 py-12 text-center'>
      <div className='mb-4 flex size-12 items-center justify-center rounded-full bg-bg-weak-50 text-text-soft-400 ring-1 ring-inset ring-stroke-soft-200'>
        <RiNotification3Line className='size-6' />
      </div>
      <div className='text-label-sm text-text-strong-950'>
        You&apos;re all caught up
      </div>
      <p className='mt-1 max-w-64 text-paragraph-xs text-text-sub-600'>
        New Scouter alerts and team activity will appear here.
      </p>
    </div>
  );
}

function NotificationFeed({ items }: { items: Notification[] }) {
  if (!items.length) return <EmptyNotifications />;

  return (
    <div className='flex flex-col gap-1'>
      {items.map((item, index) => (
        <div key={item.id}>
          {index > 0 && <Divider.Root variant='line-spacing' />}
          <div className='flex items-start gap-[15px] rounded-lg p-3 text-paragraph-sm text-text-strong-950'>
            <Avatar.Root size='40'>
              <Avatar.Image src={item.avatar} />
              {item.unread && (
                <Avatar.Indicator position='top'>
                  <Avatar.Status status='busy' />
                </Avatar.Indicator>
              )}
            </Avatar.Root>
            <div className='space-y-1'>
              <div className='text-label-sm font-normal text-text-sub-600 [&>strong]:font-medium [&>strong]:text-text-strong-950'>
                <strong>{item.actor}</strong> {item.message}
              </div>
              <div className='flex items-center gap-1 text-paragraph-xs text-text-sub-600'>
                <span>{item.time}</span>
                <span className='px-0.5'>∙</span>
                <div className='flex items-center gap-1'>
                  {item.contextIcon && (
                    <img
                      src={item.contextIcon}
                      alt=''
                      className='size-4 shrink-0'
                    />
                  )}
                  <span>{item.context}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationButton({
  ...rest
}: React.ComponentPropsWithoutRef<typeof TopbarItemButton.Root>) {
  const unreadCount = notifications.filter((item) => item.unread).length;
  const inboxItems = notifications.filter((item) => item.category === 'inbox');
  const followingItems = notifications.filter(
    (item) => item.category === 'following',
  );
  const archivedItems = notifications.filter(
    (item) => item.category === 'archived',
  );

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <TopbarItemButton.Root hasNotification={unreadCount > 0} {...rest}>
          <TopbarItemButton.Icon as={RiNotification3Line} />
        </TopbarItemButton.Root>
      </Popover.Trigger>
      <Popover.Content
        showArrow={false}
        className='w-screen max-w-[calc(100%-36px)] rounded-20 p-0 shadow-none min-[480px]:max-w-[448px]'
      >
        <TabMenuHorizontal.Root defaultValue='all'>
          <div className='flex h-14 items-center justify-between px-5'>
            <span className='text-label-md text-text-strong-950'>
              Notifications
            </span>
            {unreadCount > 0 && (
              <LinkButton.Root variant='primary' size='medium'>
                Mark all as read
              </LinkButton.Root>
            )}
          </div>
          <div className='flex items-center justify-between gap-5 border-y border-stroke-soft-200 px-5'>
            <TabMenuHorizontal.List
              className='gap-5 border-y-transparent'
              wrapperClassName='-my-px'
            >
              <TabMenuHorizontal.Trigger value='all'>
                All
              </TabMenuHorizontal.Trigger>
              <TabMenuHorizontal.Trigger value='inbox'>
                Inbox
                {unreadCount > 0 && (
                  <Badge.Root
                    size='small'
                    color='red'
                    variant='filled'
                    square
                    className='-ml-0.5'
                  >
                    {unreadCount}
                  </Badge.Root>
                )}
              </TabMenuHorizontal.Trigger>
              <TabMenuHorizontal.Trigger value='following'>
                Following
              </TabMenuHorizontal.Trigger>
              <div
                className='h-5 w-px shrink-0 bg-stroke-soft-200'
                role='separator'
              />
              <TabMenuHorizontal.Trigger value='archived'>
                Archived
              </TabMenuHorizontal.Trigger>
            </TabMenuHorizontal.List>
            <CompactButton.Root fullRadius size='large' variant='ghost'>
              <CompactButton.Icon as={RiFilter3Fill} />
            </CompactButton.Root>
          </div>

          <div className='p-2'>
            <TabMenuHorizontal.Content
              className='data-[state=active]:duration-300 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-left-2'
              value='all'
            >
              <NotificationFeed items={notifications} />
            </TabMenuHorizontal.Content>
            <TabMenuHorizontal.Content
              className='data-[state=active]:duration-300 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-left-2'
              value='inbox'
            >
              <NotificationFeed items={inboxItems} />
            </TabMenuHorizontal.Content>
            <TabMenuHorizontal.Content
              className='data-[state=active]:duration-300 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-left-2'
              value='following'
            >
              <NotificationFeed items={followingItems} />
            </TabMenuHorizontal.Content>
            <TabMenuHorizontal.Content
              className='data-[state=active]:duration-300 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-left-2'
              value='archived'
            >
              <NotificationFeed items={archivedItems} />
            </TabMenuHorizontal.Content>
          </div>

          <div className='flex h-12 items-center justify-between border-t border-stroke-soft-200 px-5'>
            <div className='flex items-center gap-2 text-paragraph-xs text-text-sub-600'>
              Use
              <div className='ring-inside flex size-5 shrink-0 items-center justify-center rounded bg-bg-weak-50 text-text-sub-600 ring-1 ring-stroke-soft-200'>
                <RiContractRightLine className='size-4' />
              </div>
              to navigate
            </div>

            <LinkButton.Root size='small' variant='gray'>
              <LinkButton.Icon as={RiSettings2Line} />
              Manage Notification
            </LinkButton.Root>
          </div>
        </TabMenuHorizontal.Root>
      </Popover.Content>
    </Popover.Root>
  );
}
