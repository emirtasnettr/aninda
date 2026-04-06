import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-10 flex flex-col gap-6 sm:mb-12 sm:flex-row sm:items-end sm:justify-between sm:gap-8 md:mb-14">
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em] text-foreground md:text-[2rem] md:leading-tight lg:text-[2.125rem]">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-3 max-w-none text-[0.9375rem] leading-7 md:text-base md:leading-8 xl:max-w-3xl 2xl:max-w-4xl">
            {description}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{children}</div>
      ) : null}
    </div>
  );
}
