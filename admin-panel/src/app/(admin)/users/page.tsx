"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createStaffUser, fetchStaffUsers } from "@/lib/api/users";
import type { StaffUser } from "@/lib/api/types";
import {
  canCreateStaffUsers,
  canViewUsers,
} from "@/lib/auth-storage";
import { formatDateTimeTr } from "@/lib/format-date";
import { roleLabel } from "@/lib/role-labels";
import { CREATABLE_USER_ROLES } from "@/lib/staff-roles";
import { useAuth } from "@/context/auth-context";

export default function UsersPage() {
  const { user } = useAuth();
  const allowed = user && canViewUsers(user.role);
  const canCreate = user && canCreateStaffUsers(user.role);

  const [list, setList] = useState<StaffUser[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>(CREATABLE_USER_ROLES[0]);

  const load = useCallback(async () => {
    if (!allowed) return;
    setErr(null);
    try {
      const data = await fetchStaffUsers();
      setList(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Liste yüklenemedi");
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate() {
    setFormErr(null);
    if (password.length < 8) {
      setFormErr("Şifre en az 8 karakter olmalı.");
      return;
    }
    setCreating(true);
    try {
      await createStaffUser({ email: email.trim(), password, role });
      setDialogOpen(false);
      setEmail("");
      setPassword("");
      setRole(CREATABLE_USER_ROLES[0]);
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Oluşturulamadı");
    } finally {
      setCreating(false);
    }
  }

  if (!allowed) {
    return (
      <>
        <PageHeader
          title="Kullanıcılar"
          description="Bu sayfayı yalnızca yönetici ve operasyon müdürü görür."
        />
        <EmptyState
          title="Erişim yok"
          description="Kullanıcı listesi için ADMIN veya OPERATIONS_MANAGER rolü gerekir."
        />
      </>
    );
  }

  if (err) {
    return (
      <>
        <PageHeader title="Kullanıcılar" />
        <div className="text-destructive bg-destructive/5 rounded-lg border border-destructive/20 p-4 text-sm">
          {err}
        </div>
      </>
    );
  }

  if (list === null) {
    return (
      <>
        <PageHeader title="Kullanıcılar" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Kullanıcılar"
        description="Sistemdeki hesaplar. Yönetici yeni personel veya müşteri hesabı ekleyebilir (kurye uygulama kaydıyla oluşur)."
      >
        {canCreate ? (
          <Button type="button" onClick={() => setDialogOpen(true)}>
            Yeni kullanıcı
          </Button>
        ) : null}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Liste</CardTitle>
          <CardDescription>{list.length} kayıt</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {list.length === 0 ? (
            <EmptyState title="Henüz kullanıcı yok" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Kayıt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{roleLabel(u.role)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTimeTr(u.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni kullanıcı</DialogTitle>
            <DialogDescription>
              E-posta benzersiz olmalı. Kurye hesabı için mobil uygulamadan kayıt
              kullanın.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="nu-email">E-posta</Label>
              <Input
                id="nu-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nu-password">Şifre (min. 8)</Label>
              <Input
                id="nu-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nu-role">Rol</Label>
              <select
                id="nu-role"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {CREATABLE_USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            {formErr ? (
              <p className="text-destructive text-sm">{formErr}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setDialogOpen(false)}
            >
              İptal
            </Button>
            <Button
              type="button"
              disabled={creating || !email.trim()}
              onClick={() => void onCreate()}
            >
              {creating ? "Kaydediliyor…" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
