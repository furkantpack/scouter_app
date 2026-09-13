'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/contexts/organization-context';
import { RiAddLine, RiCheckLine, RiExpandUpDownLine } from '@remixicon/react';

import { cn } from '@/utils/cn';
import * as Dropdown from '@/components/ui/dropdown';

type CompanyItemProps = {
  company: {
    value: string;
    name: string;
    description: string;
    logo: string;
    href: string;
  };
  selected: boolean;
  onSelect: (value: string) => void;
};

function CompanyItem({ company, selected, onSelect }: CompanyItemProps) {
  return (
    <button
      type='button'
      onClick={() => onSelect(company.value)}
      className='group/item flex w-full cursor-pointer items-center gap-3 rounded-10 p-2 text-left outline-none transition duration-200 ease-out hover:bg-bg-weak-50 focus:outline-none'
    >
      <div className='flex size-10 items-center justify-center rounded-full shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
        <img src={company.logo} alt='' className='size-6' />
      </div>
      <div className='flex-1 space-y-1'>
        <div className='text-label-sm'>{company.name}</div>
        <div className='text-paragraph-xs text-text-sub-600'>
          {company.description}
        </div>
      </div>
      {selected && <RiCheckLine className='size-5 text-text-sub-600' />}
    </button>
  );
}

function AddWorkspaceItem() {
  return (
    <button
      type='button'
      onClick={() => window.location.assign('/organization/new')}
      className='group/item mt-1 flex w-full cursor-default items-center gap-3 rounded-10 p-2 text-left outline-none transition duration-200 ease-out hover:bg-bg-weak-50'
    >
      <div className='flex size-10 items-center justify-center rounded-full border border-dashed border-stroke-sub-300 bg-bg-weak-50 text-text-sub-600'>
        <RiAddLine className='size-5' />
      </div>
      <div className='flex-1 space-y-1'>
        <div className='text-label-sm'>Add Workspace</div>
        <div className='text-paragraph-xs text-text-sub-600'>
          Create a new workspace
        </div>
      </div>
    </button>
  );
}

export function CompanySwitch({ className }: { className?: string }) {
  const router = useRouter();
  const {memberships,membership,switchOrganization}=useWorkspace();
  const [switching,setSwitching]=React.useState(false);
  const companies=memberships.map(item=>({value:item.organization_id,name:item.organization?.name||'Organization',description:item.role,logo:'/images/brand/scouter-mark.webp',href:'/dashboard'}));
  const selectedItem=membership?.organization_id||'';

  const handleSelect = async (value: string) => {
    if(switching||value===selectedItem)return;
    setSwitching(true);
    try {await switchOrganization(value);window.location.assign('/auth/continue');}
    catch(error){setSwitching(false);window.alert(error instanceof Error?error.message:'Could not switch organization.');}
  };

  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        className={cn(
          'relative flex w-full items-center justify-start whitespace-nowrap px-4 py-3 text-left outline-none focus:outline-none',
          className,
        )}
      >
        <div
          className='flex w-full shrink-0 items-center justify-start'
          data-hide-collapsed
        >
          <div className='flex flex-col items-start space-y-1'>
            {selectedItem === 'scouter' ? (
              <img
                src='/images/brand/scouter-wordmark.webp'
                alt='Scouter'
                className='h-5 w-auto object-contain'
              />
            ) : (
              <div className='text-label-sm'>
                {
                  companies.find((company) => company.value === selectedItem)
                    ?.name
                }
              </div>
            )}
            <div className='text-paragraph-xs text-text-sub-600'>
              {
                companies.find((company) => company.value === selectedItem)
                  ?.description
              }
            </div>
          </div>
          <div className='absolute right-0 flex size-6 items-center justify-center rounded-md border border-stroke-soft-200 bg-bg-white-0 shadow-regular-xs'>
            <RiExpandUpDownLine className='size-5 text-text-sub-600' />
          </div>
        </div>
      </Dropdown.Trigger>
      <Dropdown.Content side='right' sideOffset={24} align='start'>
        {companies.map((company, i) => (
          <CompanyItem
            key={i}
            company={company}
            selected={selectedItem === company.value}
            onSelect={handleSelect}
          />
        ))}
        <AddWorkspaceItem />
      </Dropdown.Content>
    </Dropdown.Root>
  );
}

export function CompanySwitchMobile({ className }: { className?: string }) {
  const router = useRouter();
  const {memberships,membership,switchOrganization}=useWorkspace();
  const [switching,setSwitching]=React.useState(false);
  const companies=memberships.map(item=>({value:item.organization_id,name:item.organization?.name||'Organization',description:item.role,logo:'/images/brand/scouter-mark.webp',href:'/dashboard'}));
  const selectedItem=membership?.organization_id||'';

  const handleSelect = async (value: string) => {
    if(switching||value===selectedItem)return;
    setSwitching(true);
    try {await switchOrganization(value);window.location.assign('/auth/continue');}
    catch(error){setSwitching(false);window.alert(error instanceof Error?error.message:'Could not switch organization.');}
  };

  return (
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger
        className={cn(
          'group flex w-full items-center gap-3 whitespace-nowrap px-4 py-[18px] text-left outline-none focus:outline-none',
          className,
        )}
      >
        <img
          src={
            companies.find((company) => company.value === selectedItem)?.logo
          }
          alt=''
          className='size-11'
        />
        <div className='flex-1 space-y-1'>
          <div className='text-label-md'>
            {companies.find((company) => company.value === selectedItem)?.name}
          </div>
          <div className='text-paragraph-sm text-text-sub-600'>
            {
              companies.find((company) => company.value === selectedItem)
                ?.description
            }
          </div>
        </div>
        <div
          className={cn(
            'flex size-6 items-center justify-center rounded-md border border-stroke-soft-200 bg-bg-white-0 text-text-sub-600 shadow-regular-xs transition duration-200 ease-out',
            // open
            'group-data-[state=open]:border-bg-strong-950 group-data-[state=open]:bg-bg-strong-950 group-data-[state=open]:text-text-white-0',
          )}
        >
          <RiExpandUpDownLine className='size-5' />
        </div>
      </Dropdown.Trigger>
      <Dropdown.Content
        side='bottom'
        align='end'
        sideOffset={-12}
        alignOffset={16}
        className=''
      >
        {companies.map((company, i) => (
          <CompanyItem
            key={i}
            company={company}
            selected={selectedItem === company.value}
            onSelect={handleSelect}
          />
        ))}
        <AddWorkspaceItem />
      </Dropdown.Content>
    </Dropdown.Root>
  );
}
