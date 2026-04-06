type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 py-16 text-center">
      <p className="text-foreground text-sm font-semibold tracking-tight">
        {title}
      </p>
      {description ? (
        <p className="text-muted-foreground mx-auto mt-2.5 max-w-md text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
  );
}
