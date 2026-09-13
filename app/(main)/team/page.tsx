'use client';

import { useState } from 'react';
import {
  RiLink,
  RiMailLine,
  RiShieldUserLine,
  RiTeamLine,
  RiUserAddLine,
} from '@remixicon/react';
import Header from '@/components/header';
import { DashedDivider } from '@/components/dashed-divider';
import * as Button from '@/components/ui/button';
import { useWorkspace } from '@/contexts/organization-context';
import { requestJson } from '@/lib/request-json';

const TEAM_ACCENT = '#2563EB';
const TEAM_SOFT = '#EFF6FF';

export default function Team() {
  const { membership, loading } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const roles =
    membership?.role === 'owner'
      ? ['admin', 'member', 'viewer']
      : membership?.role === 'admin'
        ? ['member', 'viewer']
        : [];

  return (
    <>
      <Header
        title="Team invitations"
        description="Invite people to your active organization."
        icon={
          <div className="flex size-12 items-center justify-center rounded-full bg-bg-white-0 text-text-sub-600 shadow-xs ring-1 ring-inset ring-stroke-soft-200">
            <RiTeamLine className="size-6" />
          </div>
        }
      />
      <DashedDivider />

      <div className="px-4 pb-10 lg:px-8">
        <section className="grid border-b border-stroke-soft-200 sm:grid-cols-3">
          <div className="px-4 py-6 sm:border-r sm:border-stroke-soft-200">
            <p className="text-label-sm text-text-sub-600">Workspace role</p>
            <p className="mt-2 text-title-h5 font-medium capitalize text-text-strong-950">
              {loading ? 'Loading…' : membership?.role || 'Not available'}
            </p>
            <p className="mt-1 text-paragraph-xs text-text-soft-400">Your current permission level</p>
          </div>
          <div className="border-t border-stroke-soft-200 px-4 py-6 sm:border-r sm:border-t-0">
            <p className="text-label-sm text-text-sub-600">Assignable roles</p>
            <p className="mt-2 text-title-h5 font-medium text-text-strong-950">
              {loading ? '—' : roles.length}
            </p>
            <p className="mt-1 text-paragraph-xs text-text-soft-400">Based on your access</p>
          </div>
          <div className="border-t border-stroke-soft-200 px-4 py-6 sm:border-t-0">
            <p className="text-label-sm text-text-sub-600">Invite method</p>
            <p className="mt-2 text-title-h5 font-medium text-text-strong-950">Secure link</p>
            <p className="mt-1 text-paragraph-xs text-text-soft-400">Unique to the invited email</p>
          </div>
        </section>

        <div className="py-6">
          <h2 className="text-title-h5 font-medium text-text-strong-950">Invite a teammate</h2>
          <p className="mt-1 text-paragraph-sm text-text-sub-600">
            Choose an email and workspace role to create a shareable invitation.
          </p>
        </div>

        <section className="max-w-3xl overflow-hidden rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200">
          <div
            className="flex min-h-28 items-end rounded-2xl bg-gradient-to-br from-white px-5 py-5"
            style={{ backgroundColor: TEAM_SOFT }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex size-12 items-center justify-center rounded-xl bg-bg-white-0 shadow-xs ring-1 ring-inset ring-stroke-soft-200"
                style={{ color: TEAM_ACCENT }}
              >
                <RiUserAddLine className="size-6" />
              </div>
              <div>
                <p className="text-label-sm text-text-sub-600">Team access</p>
                <h3 className="text-title-h6 font-medium text-text-strong-950">New invitation</h3>
              </div>
            </div>
          </div>

          <div className="mt-6 border-y border-stroke-soft-200 py-6">
            {loading ? (
              <p role="status" className="text-paragraph-sm text-text-sub-600">
                Loading organization…
              </p>
            ) : roles.length ? (
              <form
                className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_180px]"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (pending) return;
                  const data = Object.fromEntries(new FormData(event.currentTarget));
                  setPending(true);
                  setError('');
                  setLink('');
                  try {
                    const result = await requestJson('/api/invites', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify(data),
                    });
                    setLink(result.inviteUrl);
                  } catch (requestError) {
                    setError(
                      requestError instanceof Error
                        ? requestError.message
                        : 'Could not create invitation.',
                    );
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <label className="block text-label-sm text-text-strong-950">
                  Email
                  <span className="relative mt-2 block">
                    <RiMailLine className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-soft-400" />
                    <input
                      required
                      name="email"
                      type="email"
                      maxLength={254}
                      placeholder="teammate@company.com"
                      className="h-11 w-full rounded-10 bg-bg-white-0 pl-10 pr-3 text-paragraph-sm text-text-strong-950 shadow-xs ring-1 ring-inset ring-stroke-soft-200 outline-none transition focus:ring-2 focus:ring-primary-base"
                    />
                  </span>
                </label>

                <label className="block text-label-sm text-text-strong-950">
                  Role
                  <select
                    name="role"
                    className="mt-2 h-11 w-full rounded-10 bg-bg-white-0 px-3 text-paragraph-sm capitalize text-text-strong-950 shadow-xs ring-1 ring-inset ring-stroke-soft-200 outline-none transition focus:ring-2 focus:ring-primary-base"
                  >
                    {roles.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                </label>

                <div className="sm:col-span-2">
                  <Button.Root type="submit" disabled={pending}>
                    <Button.Icon as={RiLink} />
                    {pending ? 'Creating…' : 'Create invite link'}
                  </Button.Root>
                </div>
              </form>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl bg-bg-weak-50 p-4 ring-1 ring-inset ring-stroke-soft-200">
                <RiShieldUserLine className="mt-0.5 size-5 shrink-0 text-text-soft-400" />
                <div>
                  <p className="text-label-sm text-text-strong-950">Invitation access restricted</p>
                  <p className="mt-1 text-paragraph-sm text-text-sub-600">
                    Your current role cannot invite teammates.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-error-lighter px-4 py-3 text-paragraph-sm text-error-base">
                {error}
              </p>
            )}

            {link && (
              <div className="mt-5 rounded-2xl p-4 ring-1 ring-inset ring-stroke-soft-200" style={{ backgroundColor: TEAM_SOFT }}>
                <p className="text-label-sm text-text-strong-950">Invitation ready</p>
                <p className="mt-1 text-paragraph-sm text-text-sub-600">
                  Share this link with the invited person.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    aria-label="Invitation link"
                    readOnly
                    value={link}
                    className="h-11 min-w-0 flex-1 rounded-10 bg-bg-white-0 px-3 text-paragraph-sm text-text-sub-600 shadow-xs ring-1 ring-inset ring-stroke-soft-200 outline-none"
                  />
                  <Button.Root
                    variant="neutral"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(link)
                        .catch(() => setError('Could not copy the link.'))
                    }
                  >
                    Copy link
                  </Button.Root>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 divide-x divide-stroke-soft-200 pt-5 text-center">
            <div className="px-2">
              <p className="text-label-xs text-text-soft-400">Recipient</p>
              <p className="mt-1 text-label-sm text-text-strong-950">Email-bound</p>
            </div>
            <div className="px-2">
              <p className="text-label-xs text-text-soft-400">Access</p>
              <p className="mt-1 text-label-sm text-text-strong-950">Role-based</p>
            </div>
            <div className="px-2">
              <p className="text-label-xs text-text-soft-400">Workspace</p>
              <p className="mt-1 text-label-sm text-text-strong-950">Organization</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
