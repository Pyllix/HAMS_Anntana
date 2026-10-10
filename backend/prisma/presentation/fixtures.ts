import { createHash } from 'node:crypto';
import { UserRole, StepActionType } from '@prisma/client';
import { originalSections } from '../demo-identities';
import { originalPresentationUsers } from './user-profiles';
import { assetLabels, partLabels } from './labels';

export const PRESENTATION_VERSION = 1;
export const PRESENTATION_MARKER = 'HAMS-PRESENT-V1';
export const presentationId = (key: string): string => {
  const hex = createHash('sha256')
    .update(`hams-presentation-v1:${key}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
export type AssetState =
  | 'NORMAL'
  | 'DAMAGED'
  | 'UNDER_REPAIR'
  | 'WAIT_DISPOSAL'
  | 'DISPOSAL'
  | 'LOST';
export type Availability =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'BORROWED'
  | 'UNAVAILABLE';
export type BorrowState =
  | 'PENDING_APPROVE'
  | 'APPROVED'
  | 'BORROWED'
  | 'PENDING_RETURN'
  | 'IN_PICKUP'
  | 'RETURNED'
  | 'REJECTED'
  | 'CANCELLED';
export interface DemoAsset {
  key: string;
  name: string;
  model: string;
  section: string;
  type: string;
  price: number;
  receivedDate: Date;
  warrantyDate: string | null;
  status: AssetState;
  availability: Availability;
  special: boolean;
  backup: boolean;
  expectedViability?: 'VIABLE' | 'WARNING' | 'UNVIABLE';
}
export interface DemoBorrow {
  key: string;
  asset: string;
  borrower: string;
  status: BorrowState;
  createdAt: Date;
  approvedAt: Date | null;
  handoverAt: Date | null;
  returnAt: Date | null;
  expectedReturn: Date;
  condition: 'Normal' | 'Damage' | null;
  source: 'SELF_SERVICE' | 'CENTER_SERVICE';
  delivery: 'PICKUP' | 'DELIVERY';
  returnMethod: 'self_return' | 'staff_pickup' | null;
  reason: string | null;
}
export interface DemoExtension {
  key: string;
  borrow: string;
  type: 'ONLINE' | 'DESK';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  currentDate: Date;
  requestedDate: Date;
  createdAt: Date;
}
export interface DemoRepair {
  key: string;
  asset: string;
  reporter: string;
  technicians: string[];
  track: StepActionType | null;
  completedSteps: number;
  rejected: boolean;
  status: string;
  createdAt: Date;
  closedAt: Date | null;
  cost: number;
  urgency: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  maintenance: boolean;
}
export interface DemoPartTxn {
  key: string;
  job: string;
  part: string;
  type: 'PENDING_WITHDRAW' | 'WITHDRAW' | 'RETURN';
  stock: 'INTERNAL' | 'EXTERNAL';
  qty: number;
  unitPrice: number;
  date: Date;
}
export interface DemoPart {
  key: string;
  name: string;
  unit?: string;
  price: number;
  minStock: number;
  opening: number;
}
export interface DemoTransfer {
  key: string;
  asset: string;
  from: string;
  to: string;
  date: Date;
}
export interface DemoDisposal {
  key: string;
  asset: string;
  date: Date;
}
export interface DemoUser {
  key: string;
  role: UserRole;
  section: string;
  verified: boolean;
  deleted: boolean;
}
export interface PresentationFixture {
  date: Date;
  sections: string[];
  users: DemoUser[];
  assets: DemoAsset[];
  borrows: DemoBorrow[];
  extensions: DemoExtension[];
  repairs: DemoRepair[];
  parts: DemoPart[];
  txns: DemoPartTxn[];
  transfers: DemoTransfer[];
  disposals: DemoDisposal[];
}

/** Anchor at noon in Bangkok; relative dates remain ordered at month/year boundaries. */
export function presentationDate(value?: string): Date {
  const dateText =
    value ??
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  const date = new Date(`${dateText}T12:00:00+07:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateText) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateText
  ) {
    throw new Error('Presentation date must be a real YYYY-MM-DD date');
  }
  return date;
}
export const daysFrom = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * 86_400_000);
export function monthBefore(date: Date, months: number, day = 10): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, day, 5),
  );
}

export function buildPresentationFixture(date: Date): PresentationFixture {
  const d = (days: number) => daysFrom(date, days);
  const sections = originalSections.map((section) => section.code);
  const user = (
    key: string,
    role: UserRole,
    section: string,
    verified = true,
    deleted = false,
  ): DemoUser => ({ key, role, section, verified, deleted });
  const users = [
    ...originalPresentationUsers.map(({ key, profile }) =>
      user(key, profile.role, profile.sectionCode),
    ),
    user('account-edit', UserRole.DEPARTMENT_STAFF, 'ICU'),
    user('account-unverified', UserRole.DEPARTMENT_STAFF, 'ER', false),
    user('account-restore', UserRole.DEPARTMENT_STAFF, 'ER', true, true),
  ];
  const fixture: PresentationFixture = {
    date,
    sections,
    users,
    assets: [],
    borrows: [],
    extensions: [],
    repairs: [],
    parts: [],
    txns: [],
    transfers: [],
    disposals: [],
  };
  const asset = (key: string, options: Partial<DemoAsset> = {}): DemoAsset => {
    const result: DemoAsset = {
      key,
      name: `เครื่องเดโม ${key}`,
      model: `HAMS-${key}`,
      section: 'CENTER',
      type: 'เครื่องมือแพทย์',
      price: 100_000,
      receivedDate: d(-730),
      warrantyDate: d(-365).toISOString().slice(0, 10),
      status: 'NORMAL',
      availability: 'AVAILABLE',
      special: false,
      backup: false,
      ...options,
    };
    fixture.assets.push(result);
    return result;
  };
  const borrow = (
    key: string,
    machine: DemoAsset,
    status: BorrowState,
    options: Partial<DemoBorrow> = {},
  ): DemoBorrow => {
    const approved = !['PENDING_APPROVE', 'REJECTED', 'CANCELLED'].includes(
      status,
    );
    const handed = [
      'BORROWED',
      'PENDING_RETURN',
      'IN_PICKUP',
      'RETURNED',
    ].includes(status);
    const returned = ['PENDING_RETURN', 'IN_PICKUP', 'RETURNED'].includes(
      status,
    );
    const result: DemoBorrow = {
      key,
      asset: machine.key,
      borrower: 'icu',
      status,
      createdAt: d(-10),
      approvedAt: approved ? d(-9) : null,
      handoverAt: handed ? d(-8) : null,
      returnAt: returned ? d(-1) : null,
      expectedReturn: d(3),
      condition: status === 'RETURNED' ? 'Normal' : null,
      source: 'SELF_SERVICE',
      delivery: 'PICKUP',
      returnMethod: returned ? 'staff_pickup' : null,
      reason: ['REJECTED', 'CANCELLED'].includes(status)
        ? status === 'REJECTED'
          ? 'ต้องสำรองเครื่องสำหรับภารกิจฉุกเฉิน'
          : 'แผนกมีเครื่องพร้อมใช้งานแล้วจึงขอยกเลิก'
        : null,
      ...options,
    };
    fixture.borrows.push(result);
    machine.availability = ['PENDING_APPROVE', 'APPROVED'].includes(status)
      ? 'RESERVED'
      : status === 'BORROWED'
        ? 'BORROWED'
        : ['PENDING_RETURN', 'IN_PICKUP'].includes(status)
          ? 'UNAVAILABLE'
          : 'AVAILABLE';
    if (result.condition === 'Damage') {
      machine.status = 'DAMAGED';
      machine.availability = 'UNAVAILABLE';
    }
    return result;
  };
  const repair = (
    key: string,
    machine: DemoAsset,
    track: StepActionType | null,
    completedSteps: number,
    status: string,
    options: Partial<DemoRepair> = {},
  ): DemoRepair => {
    const closed = ['COMPLETED', 'CANCELLED'].includes(status);
    const result: DemoRepair = {
      key,
      asset: machine.key,
      reporter:
        machine.section === 'ER'
          ? 'er'
          : machine.section === 'ICU'
            ? 'icu'
            : 'center',
      technicians: track ? ['tech-a'] : [],
      track,
      completedSteps,
      rejected: false,
      status,
      createdAt: d(-5),
      closedAt: closed ? d(-1) : null,
      cost: 0,
      urgency: 'NORMAL',
      maintenance: false,
      ...options,
    };
    fixture.repairs.push(result);
    machine.status = closed
      ? track === StepActionType.UNREPAIRABLE && status === 'COMPLETED'
        ? 'WAIT_DISPOSAL'
        : 'NORMAL'
      : 'UNDER_REPAIR';
    machine.availability =
      machine.status === 'NORMAL' ? 'AVAILABLE' : 'UNAVAILABLE';
    return result;
  };
  asset('live-start', {
    name: 'เครื่องสำหรับเริ่มเรื่องยืม–คืน–ส่งซ่อมสด',
    special: true,
    backup: true,
  });
  asset('metadata-edit', {
    section: 'ICU',
    type: 'คอมพิวเตอร์และอุปกรณ์',
    name: 'คอมพิวเตอร์สำหรับแก้ไขทะเบียนและรูปภาพ',
  });
  asset('damaged-intake', {
    section: 'ER',
    status: 'DAMAGED',
    availability: 'UNAVAILABLE',
  });

  for (const status of [
    'PENDING_APPROVE',
    'APPROVED',
    'BORROWED',
    'PENDING_RETURN',
    'IN_PICKUP',
    'RETURNED',
    'REJECTED',
    'CANCELLED',
  ] as const) {
    borrow(
      `borrow-${status.toLowerCase()}`,
      asset(`loan-${status.toLowerCase()}`),
      status,
    );
  }
  borrow('borrow-center-delivery', asset('loan-center-delivery'), 'BORROWED', {
    source: 'CENTER_SERVICE',
    delivery: 'DELIVERY',
    borrower: 'er',
    createdAt: d(-8),
    approvedAt: d(-8),
    handoverAt: d(-8),
  });
  borrow('borrow-overdue', asset('loan-overdue'), 'BORROWED', {
    expectedReturn: d(-2),
  });
  borrow('borrow-return-damaged', asset('loan-return-damaged'), 'RETURNED', {
    condition: 'Damage',
    returnMethod: 'self_return',
  });
  borrow('borrow-return-normal', asset('loan-return-normal'), 'RETURNED', {
    returnMethod: 'self_return',
  });
  borrow('borrow-lost-action', asset('loan-lost-action'), 'BORROWED');
  for (const status of [
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'DESK',
  ] as const) {
    const parent = borrow(
      `extension-loan-${status.toLowerCase()}`,
      asset(`extension-${status.toLowerCase()}`),
      'BORROWED',
    );
    fixture.extensions.push({
      key: `extension-${status.toLowerCase()}`,
      borrow: parent.key,
      type: status === 'DESK' ? 'DESK' : 'ONLINE',
      status: status === 'DESK' ? 'APPROVED' : status,
      currentDate: d(3),
      requestedDate: d(10),
      createdAt: d(-1),
    });
    if (status === 'APPROVED' || status === 'DESK')
      parent.expectedReturn = d(10);
  }

  for (const [key, usage, idle] of [
    ['rotation-heavy', 30, 2],
    ['rotation-medium', 10, 15],
  ] as const) {
    const machine = asset(key, { model: 'HAMS Rotation 100' });
    borrow(key, machine, 'RETURNED', {
      createdAt: d(-idle - usage - 2),
      approvedAt: d(-idle - usage - 1),
      handoverAt: d(-idle - usage),
      returnAt: d(-idle),
      expectedReturn: d(-idle),
      returnMethod: 'self_return',
    });
  }
  asset('rotation-new', { model: 'HAMS Rotation 100', receivedDate: d(-45) });
  for (const key of ['rotation-even-a', 'rotation-even-b']) {
    const machine = asset(key, { model: 'HAMS Balanced 200' });
    borrow(key, machine, 'RETURNED', {
      createdAt: d(-6),
      approvedAt: d(-5),
      handoverAt: d(-4),
      returnAt: d(-2),
      expectedReturn: d(-2),
      returnMethod: 'self_return',
    });
  }

  repair(
    'repair-pending',
    asset('repair-pending', { section: 'ICU' }),
    null,
    0,
    'PENDING_ASSIGN',
    { urgency: 'URGENT' },
  );
  repair(
    'repair-assigned',
    asset('repair-assigned', { section: 'ER' }),
    null,
    0,
    'IN_PROGRESS',
    { technicians: ['tech-a', 'tech-b'], urgency: 'EMERGENCY' },
  );
  repair(
    'repair-self-active',
    asset('repair-self-active', { section: 'ICU' }),
    StepActionType.SELF_REPAIR,
    3,
    'IN_PROGRESS',
  );
  repair(
    'repair-self-delivery',
    asset('repair-self-delivery', { section: 'ICU' }),
    StepActionType.SELF_REPAIR,
    5,
    'WAITING_DELIVERY',
  );
  repair(
    'repair-self-closed',
    asset('repair-self-closed', { section: 'ER' }),
    StepActionType.SELF_REPAIR,
    6,
    'COMPLETED',
    { technicians: ['tech-b'], maintenance: true },
  );
  for (const key of ['internal', 'external', 'mixed']) {
    repair(
      `repair-parts-${key}`,
      asset(`repair-parts-${key}`, { section: 'ICU' }),
      StepActionType.WITH_PARTS,
      4,
      key === 'internal' ? 'IN_PROGRESS' : 'WAITING_PARTS',
      { rejected: key === 'reject' },
    );
  }
  repair(
    'repair-parts-rejected',
    asset('repair-parts-rejected', { section: 'ER' }),
    StepActionType.WITH_PARTS,
    4,
    'IN_PROGRESS',
    { rejected: true },
  );
  repair(
    'repair-parts-receipt',
    asset('repair-parts-receipt', { section: 'ICU' }),
    StepActionType.WITH_PARTS,
    5,
    'IN_PROGRESS',
  );
  repair(
    'repair-parts-delivery',
    asset('repair-parts-delivery', { section: 'ER' }),
    StepActionType.WITH_PARTS,
    7,
    'WAITING_DELIVERY',
  );
  repair(
    'repair-parts-closed',
    asset('repair-parts-closed', { section: 'ICU' }),
    StepActionType.WITH_PARTS,
    8,
    'COMPLETED',
  );
  repair(
    'repair-outsource-approval',
    asset('repair-outsource-approval', { section: 'ER' }),
    StepActionType.OUTSOURCE,
    4,
    'PARCEL_PROCESSING',
  );
  repair(
    'repair-outsource-sent',
    asset('repair-outsource-sent', { section: 'ICU' }),
    StepActionType.OUTSOURCE,
    5,
    'OUTSOURCED',
    { cost: 12_000 },
  );
  repair(
    'repair-outsource-closed',
    asset('repair-outsource-closed', { section: 'ER' }),
    StepActionType.OUTSOURCE,
    8,
    'COMPLETED',
    { cost: 18_000 },
  );
  repair(
    'repair-unrepairable-delivery',
    asset('repair-unrepairable-delivery', { section: 'ICU' }),
    StepActionType.UNREPAIRABLE,
    4,
    'UNREPAIRABLE',
  );
  repair(
    'repair-unrepairable-receipt',
    asset('repair-unrepairable-receipt', { section: 'ER' }),
    StepActionType.UNREPAIRABLE,
    5,
    'UNREPAIRABLE',
  );
  repair(
    'repair-unrepairable-closed',
    asset('repair-unrepairable-closed', { section: 'ICU' }),
    StepActionType.UNREPAIRABLE,
    8,
    'COMPLETED',
  );
  repair(
    'repair-cancelled',
    asset('repair-cancelled', { section: 'ER' }),
    null,
    0,
    'CANCELLED',
  );
  repair(
    'repair-lost-action',
    asset('repair-lost-action', { section: 'ICU' }),
    StepActionType.SELF_REPAIR,
    3,
    'IN_PROGRESS',
  );

  fixture.parts.push(
    {
      key: 'filter',
      name: 'ฟิลเตอร์เดโม',
      price: 500,
      minStock: 5,
      opening: 250,
    },
    {
      key: 'sensor',
      name: 'เซนเซอร์เดโม',
      price: 1_000,
      minStock: 5,
      opening: 100,
    },
    {
      key: 'battery-low',
      name: 'แบตเตอรี่ใกล้หมด',
      price: 2_000,
      minStock: 5,
      opening: 2,
    },
    {
      key: 'motor-empty',
      name: 'มอเตอร์หมดคลัง',
      price: 3_000,
      minStock: 2,
      opening: 0,
    },
    {
      key: 'cable-threshold',
      name: 'สายสัญญาณเท่าจุดขั้นต่ำ',
      price: 800,
      minStock: 5,
      opening: 5,
    },
  );
  for (const [key, price, minStock, opening, unit] of [
    ['spo2-cable', 850, 5, 24, 'เส้น'],
    ['nibp-cuff-adult', 650, 5, 30, 'ชิ้น'],
    ['nibp-cuff-child', 550, 3, 12, 'ชิ้น'],
    ['nibp-hose', 450, 5, 20, 'เส้น'],
    ['temperature-probe', 1800, 3, 8, 'ชิ้น'],
    ['infusion-battery', 2400, 3, 2, 'ก้อน'],
    ['infusion-door', 1250, 2, 6, 'ชุด'],
    ['syringe-drive', 4200, 3, 2, 'ชุด'],
    ['suction-tube', 180, 10, 40, 'เส้น'],
    ['suction-jar', 750, 3, 10, 'ใบ'],
    ['suction-seal', 120, 5, 15, 'ชิ้น'],
    ['ventilator-valve', 3200, 2, 5, 'ชุด'],
    ['nebulizer-filter', 90, 10, 50, 'ชิ้น'],
    ['power-cord', 350, 5, 5, 'เส้น'],
    ['ceramic-fuse', 45, 10, 60, 'ตัว'],
  ] as const) {
    fixture.parts.push({
      key,
      name: partLabels[key].name,
      price,
      minStock,
      opening,
      unit,
    });
  }
  const txn = (
    key: string,
    job: string,
    part: string,
    qty: number,
    type: DemoPartTxn['type'],
    stock: DemoPartTxn['stock'] = 'INTERNAL',
    when = d(-2),
  ) => {
    const unitPrice = fixture.parts.find((p) => p.key === part)!.price;
    fixture.txns.push({
      key,
      job,
      part,
      qty,
      type,
      stock,
      date: when,
      unitPrice,
    });
  };
  txn(
    'parts-internal',
    'repair-parts-internal',
    'filter',
    2,
    'PENDING_WITHDRAW',
  );
  txn(
    'parts-external',
    'repair-parts-external',
    'motor-empty',
    1,
    'PENDING_WITHDRAW',
    'EXTERNAL',
  );
  txn('parts-mixed-in', 'repair-parts-mixed', 'filter', 2, 'PENDING_WITHDRAW');
  txn(
    'parts-mixed-out',
    'repair-parts-mixed',
    'motor-empty',
    1,
    'PENDING_WITHDRAW',
    'EXTERNAL',
  );
  txn('parts-receipt', 'repair-parts-receipt', 'filter', 2, 'PENDING_WITHDRAW');
  txn(
    'parts-delivery',
    'repair-parts-delivery',
    'filter',
    3,
    'WITHDRAW',
    'INTERNAL',
    d(-1.25),
  );
  txn(
    'parts-delivery-return',
    'repair-parts-delivery',
    'filter',
    1,
    'RETURN',
    'INTERNAL',
    d(-1),
  );
  txn('parts-closed', 'repair-parts-closed', 'sensor', 2, 'WITHDRAW');

  for (const [key, cost, expected, age, count] of [
    ['viable', 20_000, 'VIABLE', 730, 1],
    ['warning-cost', 55_000, 'WARNING', 730, 1],
    ['unviable-cost', 75_000, 'UNVIABLE', 730, 1],
    ['warning-frequency', 3_000, 'WARNING', 730, 3],
    ['unviable-age', 3_000, 'UNVIABLE', 365 * 7, 3],
    ['donation', 3_000, 'UNVIABLE', 365 * 7, 3],
    ['warranty', 80_000, 'VIABLE', 365, 1],
  ] as const) {
    const machine = asset(`viability-${key}`, {
      section: 'ICU',
      price: key === 'donation' ? 0 : 100_000,
      receivedDate: d(-age),
      warrantyDate:
        key === 'warranty' ? d(365).toISOString().slice(0, 10) : null,
      expectedViability: expected,
    });
    for (let i = 0; i < count; i++) {
      const when = d(-120 + i * 30);
      repair(
        `viability-${key}-${i + 1}`,
        machine,
        StepActionType.OUTSOURCE,
        8,
        'COMPLETED',
        { cost: cost / count, createdAt: when, closedAt: daysFrom(when, 3) },
      );
    }
  }

  const forecastAssets = ['ICU', 'ER', 'CENTER'].map((section, i) =>
    asset(`forecast-${section.toLowerCase()}`, {
      section,
      receivedDate: monthBefore(date, 19 + i),
      price: 80_000 + i * 20_000,
    }),
  );
  for (let months = 18; months >= 1; months--) {
    const machine = forecastAssets[months % 3];
    const when = monthBefore(date, months, 2);
    const key = `forecast-month-${months}`;
    repair(key, machine, StepActionType.WITH_PARTS, 8, 'COMPLETED', {
      createdAt: when,
      closedAt: daysFrom(when, 2),
      technicians: [months % 2 ? 'tech-a' : 'tech-b'],
    });
    txn(
      key,
      key,
      'filter',
      2 + (months % 5),
      'WITHDRAW',
      'INTERNAL',
      daysFrom(when, 1.5),
    );
  }
  // This month's acquisition must not be dated after the chosen presentation day.
  asset('forecast-recent-purchase', {
    section: 'ER',
    receivedDate: d(-2),
    price: 90_000,
  });
  asset('forecast-life-exceeded', {
    section: 'ER',
    receivedDate: d(-365 * 7),
    price: 120_000,
  });
  asset('forecast-life-near', {
    section: 'ICU',
    receivedDate: d(-365 * 5 + 120),
    price: 100_000,
  });
  asset('transfer-live', { section: 'ICU' });
  asset('transfer-history', { section: 'CENTER' });
  fixture.transfers.push(
    {
      key: 'transfer-history-1',
      asset: 'transfer-history',
      from: 'ICU',
      to: 'ER',
      date: d(-90),
    },
    {
      key: 'transfer-history-2',
      asset: 'transfer-history',
      from: 'ER',
      to: 'CENTER',
      date: d(-30),
    },
  );
  asset('disposal-live', {
    section: 'ICU',
    status: 'WAIT_DISPOSAL',
    availability: 'UNAVAILABLE',
    receivedDate: d(-365 * 8),
  });
  asset('disposal-history', {
    section: 'ER',
    status: 'DISPOSAL',
    availability: 'UNAVAILABLE',
    receivedDate: d(-365 * 8),
  });
  fixture.disposals.push({
    key: 'disposal-history',
    asset: 'disposal-history',
    date: d(-10),
  });
  asset('lost-history', {
    section: 'ER',
    status: 'LOST',
    availability: 'UNAVAILABLE',
  });
  fixture.assets.forEach((machine, index) => {
    const labels = assetLabels(machine, index);
    machine.name = labels.name;
    machine.model = labels.model;
  });
  fixture.parts.forEach((part) => {
    part.name = partLabels[part.key].name;
  });
  return fixture;
}

export function stockBalance(
  fixture: PresentationFixture,
  part: DemoPart,
): number {
  return fixture.txns
    .filter((t) => t.part === part.key && t.stock === 'INTERNAL')
    .reduce(
      (qty, t) =>
        qty +
        (t.type === 'RETURN' ? t.qty : t.type === 'WITHDRAW' ? -t.qty : 0),
      part.opening,
    );
}

/** Validate relationships and accounting before opening a database connection. */
export function validateFixture(f: PresentationFixture): void {
  const unique = (name: string, values: string[]) => {
    if (new Set(values).size !== values.length)
      throw new Error(`Duplicate ${name} key`);
  };
  const keyedRows: Record<string, { key: string }[]> = {
    users: f.users,
    assets: f.assets,
    borrows: f.borrows,
    extensions: f.extensions,
    repairs: f.repairs,
    parts: f.parts,
    txns: f.txns,
    transfers: f.transfers,
    disposals: f.disposals,
  };
  for (const [name, rows] of Object.entries(keyedRows))
    unique(
      name,
      rows.map((r) => r.key),
    );
  const exists = (rows: { key: string }[], key: string, label: string) => {
    if (!rows.some((r) => r.key === key))
      throw new Error(`Missing ${label}: ${key}`);
  };
  for (const row of f.users)
    if (!f.sections.includes(row.section))
      throw new Error(`Missing user section: ${row.key}`);
  for (const machine of f.assets) {
    if (!f.sections.includes(machine.section))
      throw new Error(`Missing asset section: ${machine.key}`);
    if (machine.receivedDate > f.date)
      throw new Error(`Future acquisition: ${machine.key}`);
    const loans = f.borrows.filter(
      (b) =>
        b.asset === machine.key &&
        [
          'PENDING_APPROVE',
          'APPROVED',
          'BORROWED',
          'PENDING_RETURN',
          'IN_PICKUP',
        ].includes(b.status),
    );
    const jobs = f.repairs.filter(
      (j) =>
        j.asset === machine.key &&
        !['COMPLETED', 'CANCELLED'].includes(j.status),
    );
    if (loans.length > 1 || jobs.length > 1 || (loans.length && jobs.length))
      throw new Error(`Overlapping active workflow: ${machine.key}`);
    const requiredAvailability: Availability = loans.length
      ? ['PENDING_APPROVE', 'APPROVED'].includes(loans[0].status)
        ? 'RESERVED'
        : loans[0].status === 'BORROWED'
          ? 'BORROWED'
          : 'UNAVAILABLE'
      : machine.status === 'NORMAL'
        ? 'AVAILABLE'
        : 'UNAVAILABLE';
    if (
      machine.availability !== requiredAvailability ||
      (machine.status === 'UNDER_REPAIR') !== Boolean(jobs.length)
    )
      throw new Error(`Inconsistent asset state: ${machine.key}`);
    if (loans.length && machine.status !== 'NORMAL')
      throw new Error(`Loan on unavailable asset: ${machine.key}`);
  }
  for (const loan of f.borrows) {
    exists(f.assets, loan.asset, 'borrow asset');
    exists(f.users, loan.borrower, 'borrower');
    const ordered = [
      loan.createdAt,
      loan.approvedAt,
      loan.handoverAt,
      loan.returnAt,
    ].filter((v): v is Date => v !== null);
    if (
      ordered.some(
        (v, i) =>
          !Number.isFinite(v.getTime()) ||
          v > f.date ||
          (i > 0 && v < ordered[i - 1]),
      )
    )
      throw new Error(`Invalid borrow dates: ${loan.key}`);
    if (
      ['BORROWED', 'PENDING_RETURN', 'IN_PICKUP', 'RETURNED'].includes(
        loan.status,
      ) &&
      !loan.handoverAt
    )
      throw new Error(`Missing handover: ${loan.key}`);
    if (loan.status === 'RETURNED' && (!loan.returnAt || !loan.condition))
      throw new Error(`Incomplete return: ${loan.key}`);
  }
  for (const machine of f.assets) {
    const periods = f.borrows
      .filter((b) => b.asset === machine.key && b.handoverAt)
      .sort((a, b) => a.handoverAt!.getTime() - b.handoverAt!.getTime());
    if (
      periods.some(
        (b, i) =>
          i > 0 &&
          (!periods[i - 1].returnAt ||
            periods[i - 1].returnAt! > b.handoverAt!),
      )
    )
      throw new Error(`Overlapping borrowing dates: ${machine.key}`);
  }
  for (const extension of f.extensions) {
    exists(f.borrows, extension.borrow, 'extension parent');
    if (
      extension.requestedDate <= extension.currentDate ||
      extension.requestedDate <= f.date
    )
      throw new Error(`Invalid extension date: ${extension.key}`);
    const parent = f.borrows.find((b) => b.key === extension.borrow)!;
    if (parent.status !== 'BORROWED')
      throw new Error(`Extension on inactive loan: ${extension.key}`);
    if (
      extension.status === 'APPROVED' &&
      parent.expectedReturn.getTime() !== extension.requestedDate.getTime()
    )
      throw new Error(`Extension not reflected in parent: ${extension.key}`);
  }
  for (const job of f.repairs) {
    exists(f.assets, job.asset, 'repair asset');
    exists(f.users, job.reporter, 'reporter');
    job.technicians.forEach((key) => exists(f.users, key, 'technician'));
    const max =
      job.track === StepActionType.SELF_REPAIR ? 6 : job.track ? 8 : 0;
    if (
      job.completedSteps > max ||
      job.createdAt > f.date ||
      (job.closedAt && (job.closedAt < job.createdAt || job.closedAt > f.date))
    )
      throw new Error(`Invalid repair dates/steps: ${job.key}`);
    if (job.track && !job.technicians.length)
      throw new Error(`Missing assignment: ${job.key}`);
    if (
      job.status === 'COMPLETED' &&
      (!job.closedAt || job.completedSteps !== max)
    )
      throw new Error(`Incomplete closed repair: ${job.key}`);
  }
  for (const t of f.txns) {
    exists(f.parts, t.part, 'spare part');
    exists(f.repairs, t.job, 'transaction job');
    const job = f.repairs.find((j) => j.key === t.job)!;
    if (
      t.qty <= 0 ||
      t.unitPrice < 0 ||
      t.date < job.createdAt ||
      t.date > f.date
    )
      throw new Error(`Invalid parts transaction: ${t.key}`);
    if (
      t.type === 'PENDING_WITHDRAW' &&
      (job.rejected ||
        job.completedSteps >= 6 ||
        ['COMPLETED', 'CANCELLED'].includes(job.status))
    )
      throw new Error(`Invalid pending withdrawal: ${t.key}`);
    if (t.type === 'RETURN') {
      const net = f.txns
        .filter(
          (other) =>
            other.job === t.job &&
            other.part === t.part &&
            other.stock === t.stock &&
            other.date <= t.date &&
            other.type !== 'PENDING_WITHDRAW',
        )
        .reduce(
          (qty, other) =>
            qty + (other.type === 'WITHDRAW' ? other.qty : -other.qty),
          0,
        );
      if (net < 0) throw new Error(`Return exceeds withdrawal: ${t.key}`);
    }
  }
  for (const part of f.parts)
    if (stockBalance(f, part) < 0)
      throw new Error(`Negative stock: ${part.key}`);
  for (const transfer of f.transfers) {
    exists(f.assets, transfer.asset, 'transfer asset');
    if (
      !f.sections.includes(transfer.from) ||
      !f.sections.includes(transfer.to) ||
      transfer.from === transfer.to ||
      transfer.date > f.date
    )
      throw new Error(`Invalid transfer: ${transfer.key}`);
  }
  for (const machine of f.assets) {
    const transfers = f.transfers
      .filter((t) => t.asset === machine.key)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    if (
      transfers.length &&
      transfers[transfers.length - 1].to !== machine.section
    )
      throw new Error(`Transfer destination mismatch: ${machine.key}`);
  }
  for (const disposal of f.disposals) {
    const machine = f.assets.find((a) => a.key === disposal.asset);
    if (!machine || machine.status !== 'DISPOSAL' || disposal.date > f.date)
      throw new Error(`Invalid disposal: ${disposal.key}`);
  }
}
