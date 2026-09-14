export function fundedPageEnabled() {
  return process.env.ENABLE_FUNDED_PAGE === 'true';
}

export function isFundedPagePath(pathname: string) {
  return /^\/funded\/?$/.test(pathname);
}
