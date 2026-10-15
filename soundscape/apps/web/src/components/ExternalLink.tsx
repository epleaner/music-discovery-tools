import { splitProps, type Component, type JSX } from 'solid-js';

export interface ExternalLinkProps
  extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {}

const ExternalLink: Component<ExternalLinkProps> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'target', 'rel']);

  return (
    <a
      {...rest}
      target={local.target ?? '_blank'}
      rel={local.rel ?? 'noopener noreferrer'}
      class={`link ${local.class ?? ''}`}
    />
  );
};

export default ExternalLink;
