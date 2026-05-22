import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  description,
  tooltip,
  tone = "default",
  children,
}: {
  title: string;
  value: string;
  description?: string;
  tooltip?: string;
  tone?: "default" | "positive" | "warning" | "primary";
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        tone === "positive" && "border-accent bg-accent/40",
        tone === "warning" && "border-[#f4cf76] bg-[#fff8e7] dark:bg-[#33280f]",
        tone === "primary" && "border-primary/30 bg-primary/5",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {tooltip ? (
            <InfoTip title={title}>
              <p>{tooltip}</p>
            </InfoTip>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-normal">{value}</p>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </CardContent>
    </Card>
  );
}
