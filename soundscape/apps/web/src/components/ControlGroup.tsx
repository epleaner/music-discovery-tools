import { splitProps, type Component, type JSX } from 'solid-js';

export interface ControlGroupProps extends JSX.HTMLAttributes<HTMLDivElement> {}

const ControlGroup: Component<ControlGroupProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  const className = local.class ? `control-group ${local.class}` : 'control-group';

  return <div {...rest} class={className} />;
};

export default ControlGroup;
