# shadcn/ui in This Project

## Import

Use direct imports:

```tsx
import { Button, Badge, Alert } from "@/components/ui";
```

Or via existing shared export:

```tsx
import { ShadcnUI } from "@/shared/ui";

const { Button, Badge } = ShadcnUI;
```

## Color Variants

These components support extra color variants via props:

- `Button` `variant`: `brand | success | warning`
- `Badge` `variant`: `brand | success | warning`
- `Alert` `variant`: `info | success | warning | destructive | default`

## Sync All Official UI Components Again

```bash
npm run shadcn:add:all-ui
```

With overwrite:

```bash
npm run shadcn:add:all-ui -- --overwrite
```
