"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { Equipment } from "@/types/types"
import { Button } from "@/components/ui/button"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "../ui/native-select"

export const columns: ColumnDef<Equipment>[] = [
  {
    accessorKey: "img",
    header: "รูปภาพ",
    cell: ({ row }) => {
      const imageUrl = row.getValue("img") as string

      return (
        <div className="flex items-center justify-center">
          <img
            src={imageUrl}
            alt="Equipment"
            className="h-14 w-14 rounded-md border border-slate-200/60 bg-slate-50 object-cover"
          />
        </div>
      )
    },
  },
  {
    accessorKey: "name",
    header: "รายการ / รหัส",
    cell: ({ row }) => {
      const equipment = row.original

      return (
        <div className="flex max-w-50 flex-col gap-1 py-1">
          <span className="overflow-x-hidden text-sm font-semibold text-slate-200 text-slate-800 hover:overflow-visible">
            {equipment.name}
            {equipment.engName ? ` (${equipment.engName})` : ""}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {equipment.id}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "category",
    header: "ประเภท",
  },
  {
    accessorKey: "borrowerOrDept",
    header: "ผู้ยืม / เเผนก",
  },
  {
    accessorKey: "borrowDate",
    header: "วันที่ยืม",
    cell: ({ row }) => {
      const date = row.getValue("borrowDate") as string
      const formattedDate = new Date(date).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      return <div className="">{formattedDate}</div>
    },
  },
  {
    accessorKey: "status",
    header: "สถานะ",
    cell: ({ row }) => {
      const status = row.getValue("status") as string

      if (status === "borrowing") {
        return (
          <div className="inline-flex w-20 items-center gap-1.5 rounded-full border border-red-200 bg-red-50/30 px-3 py-1 text-xs font-medium text-red-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            กำลังยืม
          </div>
        )
      }
      if (status === "available") {
        return (
          <div className="inline-flex w-20 items-center gap-1.5 rounded-full bg-emerald-100/60 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            ว่าง
          </div>
        )
      }
      if (status === "repairing") {
        return (
          <div className="inline-flex w-20 items-center gap-1.5 rounded-full border border-slate-200/60 bg-slate-200 px-3 py-1 text-xs font-medium text-slate-500 select-none">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            ส่งซ่อม
          </div>
        )
      }
      return <span className="text-xs text-slate-500">{status}</span>
    },
  },
  {
    id: "action",
    header: "จัดการ",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const equipment = row.original

      if (status === "borrowing") {
        return (
          <Dialog>
            <form>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    className="h-8 w-14 rounded-md border-emerald-500 bg-transparent px-3 text-xs font-medium text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    กำลังยืม
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>ทำรายการยืมครุภัณฑ์</DialogTitle>
                  <DialogDescription>
                    Make changes to your profile here. Click save when
                    you&apos;re done.
                  </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                  <Field>
                    <Label htmlFor="name-1">Name</Label>
                    <Input
                      id="name-1"
                      name="name"
                      defaultValue="Pedro Duarte"
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="username-1">Username</Label>
                    <Input
                      id="username-1"
                      name="username"
                      defaultValue="@peduarte"
                    />
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <DialogClose
                    render={<Button variant="outline">Cancel</Button>}
                  />
                  <Button type="submit">Save changes</Button>
                </DialogFooter>
              </DialogContent>
            </form>
          </Dialog>
        )
      }
      if (status === "available") {
        return (
          <Dialog>
            <form>
              <DialogTrigger
                render={
                  <Button className="h-8 w-14 rounded-md border-none bg-emerald-500 px-3 text-xs font-medium text-white shadow-none hover:bg-emerald-700">
                    ยืม
                  </Button>
                }
              />
              <DialogContent className="bg-white p-8 sm:max-w-lg">
                {/* หัวข้อ */}
                <DialogHeader className="flex flex-col gap-1">
                  <DialogTitle className="text-xl font-semibold">
                    ทำรายการยืมครุภัณฑ์
                  </DialogTitle>
                  {/* กรอบรูปใหญ่ */}
                  <div className="border-ring mt-2 flex rounded-md border bg-white p-3">
                    <div>
                      <img
                        className="mr-4 h-14 w-14 overflow-hidden rounded-md border border-slate-200/60 bg-slate-50 object-cover"
                        src={equipment.img}
                        alt={equipment.name}
                      />
                    </div>
                    <div className="flex flex-col justify-center gap-1">
                      <p className="text-md font-semibold">{`${equipment.name} (${equipment.engName})`}</p>
                      <span className="text-xs text-slate-500">
                        {equipment.id}
                      </span>
                    </div>
                  </div>
                </DialogHeader>
                {/* ช่องกรอกข้อมูล */}
                <FieldGroup className="gap-4">
                  <Field>
                    <Label htmlFor="name-1" className="text-sm font-bold">
                      ชื่อ-นามสกุลผู้ยืม{" "}
                    </Label>
                    <Input
                      className="h-10"
                      id="name-1"
                      name="name"
                      placeholder="กรอกชื่อ-นามสกุล"
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="username-1" className="text-sm font-bold">
                      แผนก / วอร์ด (Ward)
                    </Label>
                    <NativeSelect data-size="md">
                      <NativeSelectOption
                        value="all"
                        className="text-slate-500"
                      >
                        ประเภท: ทั้งหมด
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  <Field>
                    <Label htmlFor="date-1" className="text-sm font-bold">
                      วันที่และเวลาที่ยืม
                    </Label>
                    <Input
                      className="h-10"
                      id="date-1"
                      name="date"
                      placeholder="กรอกวันที่และเวลาที่ยืม"
                    />
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <DialogClose
                    render={<Button variant="outline">ยกเลิก</Button>}
                  />
                  <Button
                    type="submit"
                    className="border bg-emerald-500 text-white hover:bg-emerald-700"
                  >
                    ยืนยันการยืม
                  </Button>
                </DialogFooter>
              </DialogContent>
            </form>
          </Dialog>
        )
      }
      if (status === "repairing") {
        return (
          <Button
            disabled
            variant="secondary"
            className="h-8 w-14 cursor-not-allowed rounded-md border border-slate-600 bg-slate-200 px-3 text-xs text-slate-800"
          >
            ส่งซ่อม
          </Button>
        )
      }
      return <span className="text-xs text-slate-500">{status}</span>
    },
  },
]
