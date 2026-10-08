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
      variant="icon"
      class={local.class}
      title={`Fetch ${local.label} info`}
      aria-label={`Fetch ${local.label} info`}
      disabled={local.loading || rest.disabled}
      aria-busy={local.loading}
    >
      {local.loading ? '◐' : 'ⓘ'}
    </Button>
  );
};

export default InfoButton;
