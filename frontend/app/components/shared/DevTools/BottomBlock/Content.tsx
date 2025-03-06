import React from 'react';
import cn from 'classnames';
import stl from './content.module.css';

function Content({
  children,
  className,
  ...props
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(className, stl.content)} {...props}>
      {children}
    </div>
  );
}

Content.displayName = 'Content';

export default Content;
