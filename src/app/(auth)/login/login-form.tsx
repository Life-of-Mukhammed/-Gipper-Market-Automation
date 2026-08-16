"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>СантехТорг CRM</CardTitle>
        <CardDescription>Войдите в систему учёта</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Логин</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Вход..." : "Войти"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
