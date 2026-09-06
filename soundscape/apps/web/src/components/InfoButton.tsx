import { splitProps, type Component } from 'solid-js';
import Button, { type ButtonProps } from './Button';

export interface InfoButtonProps
  extends Omit<ButtonProps, 'children' | 'title' | 'aria-label' | 'variant'> {
  loading: boolean;
  label: string;
}

const InfoButton: Component<InfoButtonProps> = (props) => {
  const [local, rest] = splitProps(props, ['loading', 'label', 'class']);

  return (
    <Button
      {...rest}
      variant="link"
      class={`text-xs text-fg-subtle hover:text-fg px-1 ${local.class ?? ''}`}
      title={`Fetch ${local.label} info`}
      aria-label={`Fetch ${local.label} info`}
    >
      {local.loading ? '◐' : 'ⓘ'}
    </Button>
  );
};

export default InfoButton;
