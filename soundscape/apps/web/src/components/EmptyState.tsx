import { splitProps, type Component, type JSX } from 'solid-js';

export interface EmptyStateProps extends JSX.HTMLAttributes<HTMLDivElement> {}

const EmptyState: Component<EmptyStateProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);

  return (
    <div
      {...rest}
      class={`text-xs text-fg-muted ${local.class ?? ''}`}
    />
  );
};

export default EmptyState;
