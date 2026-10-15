import { createMemo, Show, type Component, type JSX } from 'solid-js';
import ExternalLink from './ExternalLink';

interface SourceLinkProps {
  href?: string;
  base: string;
  children: JSX.Element;
  class?: string;
}

/** Scraped metadata stays readable when no navigable source URL is available. */
const SourceLink: Component<SourceLinkProps> = (props) => {
  const href = createMemo(() => {
    if (!props.href?.trim()) return undefined;
    try {
      const url = /^https?:\/\//i.test(props.href.trim())
        ? new URL(props.href)
        : new URL(props.href, props.base);
      return url.protocol === 'https:' || url.protocol === 'http:'
        ? url.href
        : undefined;
    } catch {
      return undefined;
    }
  });

  return (
    <Show
      when={href()}
      fallback={<span class={props.class}>{props.children}</span>}
    >
      {(url) => (
        <ExternalLink href={url()} class={props.class}>
          {props.children}
        </ExternalLink>
      )}
    </Show>
  );
};

export default SourceLink;
