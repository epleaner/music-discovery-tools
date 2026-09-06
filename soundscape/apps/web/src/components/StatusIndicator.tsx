import { splitProps, type Component, type JSX } from 'solid-js';

export type StatusIndicatorState = 'online' | 'offline' | 'neutral';

export interface StatusIndicatorProps
  extends JSX.HTMLAttributes<HTMLDivElement> {
  status: StatusIndicatorState;
  label: string;
}

const stateClassName: Record<StatusIndicatorState, string> = {
  online: 'bg-green-500',
  offline: 'bg-red-500',
  neutral: 'bg-fg-subtle',
};

const StatusIndicator: Component<StatusIndicatorProps> = (props) => {
  const [local, rest] = splitProps(props, ['status', 'label', 'class']);

  return (
    <div {...rest} class={`flex items-center ${local.class ?? ''}`}>
      <span class={`w-2 h-2 rounded-full ${stateClassName[local.status]}`} />
      <span>{local.label}</span>
    </div>
  );
};

export default StatusIndicator;
