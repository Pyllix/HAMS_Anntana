import type {
  DemoAsset,
  DemoBorrow,
  DemoRepair,
  PresentationFixture,
} from './fixtures';

export const EXPANSION_PREFIX = 'volume-v2-';
export const isExpandedScenario = (key: string) =>
  key.startsWith(EXPANSION_PREFIX);

/** A hospital-sized workload, with dedicated assets so no existing workflow is moved. */
export function appendPresentationExpansion(f: PresentationFixture): void {
  const d = (days: number) => new Date(f.date.getTime() + days * 86_400_000);
  const key = (value: string) => `${EXPANSION_PREFIX}${value}`;
  const reporter = (section: string) =>
    f.users.find(
      (user) =>
        user.section === section &&
        user.role === 'DEPARTMENT_STAFF' &&
        user.verified &&
        !user.deleted,
    )?.key ??
    f.users.find(
      (user) => user.section === section && user.verified && !user.deleted,
    )?.key ??
    'center';
  const technicians = [
    'tech-a',
    'tech-b',
    'mech_it',
    'mech_general',
    'head',
    'head_it',
  ];
  const machine = (
    value: string,
    section: string,
    options: Partial<DemoAsset> = {},
  ) => {
    const index = f.assets.length;
    const result: DemoAsset = {
      key: key(value),
      name: '',
      model: '',
      section,
      type: section === 'IT' ? 'คอมพิวเตอร์และอุปกรณ์' : 'เครื่องมือแพทย์',
      price: [28000, 45000, 85000, 125000, 240000, 360000][index % 6],
      receivedDate: d(-365 - (index % 6) * 240),
      warrantyDate: index % 5 === 0 ? d(180).toISOString().slice(0, 10) : null,
      status: 'NORMAL',
      availability: 'AVAILABLE',
      special: index % 7 === 0,
      backup: index % 4 === 0,
      ...options,
    };
    f.assets.push(result);
    return result;
  };
  const parts = [
    [
      'patient-cable',
      'สายสัญญาณผู้ป่วยแบบหลายพารามิเตอร์',
      950,
      10,
      48,
      'เส้น',
    ],
    ['pressure-sensor', 'เซนเซอร์ตรวจวัดแรงดัน', 1600, 5, 22, 'ชิ้น'],
    ['power-module', 'ชุดจ่ายไฟเครื่องมือแพทย์', 2800, 5, 14, 'ชุด'],
    ['pump-motor', 'มอเตอร์ปั๊มสุญญากาศ', 3500, 2, 0, 'ตัว'],
    ['control-knob', 'ปุ่มปรับควบคุมอัตราการไหล', 320, 5, 3, 'ชิ้น'],
    ['display-panel', 'แผงหน้าจอแสดงผลเครื่องมือแพทย์', 4800, 5, 7, 'ชุด'],
    ['air-tube', 'สายลมแรงดันสำหรับอุปกรณ์การแพทย์', 220, 10, 40, 'เส้น'],
    ['ground-cable', 'สายดินสำหรับอุปกรณ์การแพทย์', 450, 5, 5, 'เส้น'],
  ] as const;
  for (const [value, name, price, minStock, opening, unit] of parts)
    f.parts.push({
      key: key(value),
      name,
      price,
      minStock,
      opening,
      unit,
      receiptAgeDays: 400,
    });
  const partKeys = parts.map(([value]) => key(value));
  const stock = (
    job: DemoRepair,
    source: 'INTERNAL' | 'EXTERNAL' | 'MIXED',
    pending: boolean,
    returned = false,
  ) => {
    const sources =
      source === 'MIXED' ? (['INTERNAL', 'EXTERNAL'] as const) : [source];
    for (const [index, origin] of sources.entries()) {
      const part = f.parts.find(
        (part) => part.key === partKeys[(f.repairs.length + index) % 3],
      )!;
      const when = new Date(
        job.createdAt.getTime() +
          ((job.closedAt ?? f.date).getTime() - job.createdAt.getTime()) * 0.4,
      );
      f.txns.push({
        key: `${job.key}-${origin.toLowerCase()}`,
        job: job.key,
        part: part.key,
        type: pending ? 'PENDING_WITHDRAW' : 'WITHDRAW',
        stock: origin,
        qty: 2 + index,
        unitPrice: part.price,
        date: when,
      });
      if (returned && !pending)
        f.txns.push({
          key: `${job.key}-${origin.toLowerCase()}-return`,
          job: job.key,
          part: part.key,
          type: 'RETURN',
          stock: origin,
          qty: 1,
          unitPrice: part.price,
          date: new Date(
            when.getTime() +
              ((job.closedAt ?? f.date).getTime() - when.getTime()) * 0.5,
          ),
        });
    }
  };
  const job = (
    value: string,
    section: string,
    track: DemoRepair['track'],
    steps: number,
    status: string,
    options: Partial<DemoRepair> = {},
  ) => {
    const asset = machine(value, section);
    const index = f.repairs.length;
    const closed = ['COMPLETED', 'CANCELLED'].includes(status);
    const result: DemoRepair = {
      key: key(value),
      asset: asset.key,
      reporter: reporter(section),
      technicians: track ? [technicians[index % technicians.length]] : [],
      track,
      completedSteps: steps,
      rejected: false,
      status,
      createdAt: d(-2 - (index % 18)),
      closedAt: closed ? d(-1) : null,
      cost: track === 'OUTSOURCE' && steps >= 5 ? 4500 + (index % 9) * 1750 : 0,
      urgency: ['NORMAL', 'URGENT', 'EMERGENCY'][
        index % 3
      ] as DemoRepair['urgency'],
      maintenance: index % 9 === 0,
      symptom: [
        'เปิดเครื่องแล้วดับเองระหว่างใช้งาน ต้องตรวจสอบระบบจ่ายไฟ',
        'ค่าที่อ่านได้คลาดเคลื่อนจากอุปกรณ์อ้างอิง ขอให้ตรวจสอบและสอบเทียบ',
        'มีสัญญาณเตือนต่อเนื่องหลังทำความสะอาดและตรวจการเชื่อมต่อ',
        'หน้าจอแสดงผลติด ๆ ดับ ๆ ทำให้ไม่สามารถใช้งานกับผู้ป่วยได้',
        'อุปกรณ์ผ่านการใช้งานต่อเนื่อง ขอรับบริการตรวจเช็กความปลอดภัย',
      ][index % 5],
      ...options,
    };
    result.dueDate ??= new Date(
      result.createdAt.getTime() + (index % 3 === 0 ? 3 : 21) * 86_400_000,
    );
    if (result.maintenance)
      result.symptom = 'ถึงกำหนดตรวจเช็กสภาพและทดสอบความปลอดภัยประจำรอบ';
    asset.status = !closed
      ? 'UNDER_REPAIR'
      : track === 'UNREPAIRABLE' && status === 'COMPLETED'
        ? 'WAIT_DISPOSAL'
        : 'NORMAL';
    asset.availability =
      asset.status === 'NORMAL' ? 'AVAILABLE' : 'UNAVAILABLE';
    f.repairs.push(result);
    return result;
  };
  for (const [sectionIndex, section] of f.sections.entries()) {
    for (const urgency of ['NORMAL', 'URGENT', 'EMERGENCY'] as const)
      job(`${section}-pending-${urgency}`, section, null, 0, 'PENDING_ASSIGN', {
        urgency,
        createdAt: d(-0.4 - (sectionIndex % 3)),
        maintenance: urgency === 'NORMAL',
      });
    job(`${section}-assess`, section, null, 0, 'IN_PROGRESS', {
      technicians: [technicians[sectionIndex % technicians.length]],
      maintenance: false,
    });
    job(`${section}-self`, section, 'SELF_REPAIR', 3, 'IN_PROGRESS', {
      action: sectionIndex % 2 ? 'MODIFY' : 'REPAIR',
    });
    for (const source of ['INTERNAL', 'EXTERNAL', 'MIXED'] as const) {
      const request = job(
        `${section}-parts-${source}`,
        section,
        'WITH_PARTS',
        4,
        source === 'INTERNAL' ? 'PARCEL_PROCESSING' : 'WAITING_PARTS',
        { maintenance: false },
      );
      stock(request, source, true);
    }
    job(
      `${section}-outsource-approve`,
      section,
      'OUTSOURCE',
      4,
      'PARCEL_PROCESSING',
      { maintenance: false },
    );
    job(`${section}-outsourced`, section, 'OUTSOURCE', 5, 'OUTSOURCED', {
      maintenance: false,
    });
    job(`${section}-delivery`, section, 'SELF_REPAIR', 5, 'WAITING_DELIVERY', {
      maintenance: false,
    });
    job(`${section}-unrepairable`, section, 'UNREPAIRABLE', 5, 'UNREPAIRABLE', {
      maintenance: false,
    });
    job(
      `${section}-unrepairable-handover`,
      section,
      'UNREPAIRABLE',
      4,
      'UNREPAIRABLE',
      { maintenance: false },
    );
    job(`${section}-parts-rejected`, section, 'WITH_PARTS', 4, 'IN_PROGRESS', {
      rejected: true,
      maintenance: false,
    });
    const approved = job(
      `${section}-parts-approved`,
      section,
      'WITH_PARTS',
      5,
      'IN_PROGRESS',
      { maintenance: false },
    );
    stock(approved, 'INTERNAL', true);
    const repairing = job(
      `${section}-parts-repairing`,
      section,
      'WITH_PARTS',
      6,
      'IN_PROGRESS',
      { maintenance: false },
    );
    stock(repairing, 'MIXED', false);
    const delivery = job(
      `${section}-parts-delivery`,
      section,
      'WITH_PARTS',
      7,
      'WAITING_DELIVERY',
      { maintenance: false },
    );
    stock(delivery, 'INTERNAL', false, true);
    job(
      `${section}-outsource-returned`,
      section,
      'OUTSOURCE',
      7,
      'WAITING_DELIVERY',
      { maintenance: false },
    );
    job(`${section}-completed`, section, 'SELF_REPAIR', 6, 'COMPLETED');
    job(`${section}-cancelled`, section, null, 0, 'CANCELLED', {
      symptom:
        'แผนกตรวจสอบแล้วพบว่าปลั๊กต่อไม่แน่น และทดสอบใช้งานได้ปกติ จึงขอยกเลิกรายการ',
    });
    for (let index = 0; index < 4; index++)
      machine(`${section}-ready-${index + 1}`, section, {
        special: index === 0,
        backup: index === 1,
      });
  }
  // Every presenting technician has today's assessment, repair and completed report rows.
  for (const [index, tech] of technicians.entries()) {
    const section = ['ICU', 'ER', 'IT', 'OPD', 'SURGERY', 'LAB'][index];
    const today = {
      createdAt: d(-0.4),
      dueDate: d(5),
      technicians: [tech],
      maintenance: false,
    };
    job(`today-${tech}-assess`, section, null, 0, 'IN_PROGRESS', today);
    job(`today-${tech}-self`, section, 'SELF_REPAIR', 3, 'IN_PROGRESS', {
      ...today,
      action: index % 2 ? 'FABRICATE' : 'MODIFY',
    });
    const pending = job(
      `today-${tech}-parts`,
      section,
      'WITH_PARTS',
      4,
      'PARCEL_PROCESSING',
      today,
    );
    stock(pending, 'MIXED', true);
    job(`today-${tech}-external`, section, 'OUTSOURCE', 5, 'OUTSOURCED', today);
    const completed = job(
      `today-${tech}-closed-parts`,
      section,
      'WITH_PARTS',
      8,
      'COMPLETED',
      { ...today, closedAt: d(-0.1) },
    );
    stock(completed, 'INTERNAL', false, true);
    job(`today-${tech}-closed-self`, section, 'SELF_REPAIR', 6, 'COMPLETED', {
      ...today,
      maintenance: true,
      closedAt: d(-0.15),
    });
  }
  // Realistic month-to-month volume across departments and all four repair routes.
  for (let month = 1; month <= 6; month++) {
    for (let index = 0; index < 6; index++) {
      const section = f.sections[(month + index) % f.sections.length];
      const track = ['SELF_REPAIR', 'WITH_PARTS', 'OUTSOURCE', 'UNREPAIRABLE'][
        index % 4
      ] as NonNullable<DemoRepair['track']>;
      const complete = job(
        `history-${month}-${index}`,
        section,
        track,
        track === 'SELF_REPAIR' ? 6 : 8,
        'COMPLETED',
        {
          createdAt: d(-month * 28 - index),
          closedAt: d(-month * 28 - index + 2),
          technicians: [technicians[index]],
          maintenance: index === 0,
        },
      );
      if (track === 'WITH_PARTS')
        stock(complete, index % 2 ? 'INTERNAL' : 'EXTERNAL', false);
    }
  }
  const loan = (
    value: string,
    borrower: string,
    status: DemoBorrow['status'],
    options: Partial<DemoBorrow> = {},
  ) => {
    const asset = machine(value, 'CENTER');
    const approved = !['PENDING_APPROVE', 'REJECTED', 'CANCELLED'].includes(
      status,
    );
    const handed = [
      'BORROWED',
      'PENDING_RETURN',
      'IN_PICKUP',
      'RETURNED',
    ].includes(status);
    const returning = ['PENDING_RETURN', 'IN_PICKUP', 'RETURNED'].includes(
      status,
    );
    const result: DemoBorrow = {
      key: key(value),
      asset: asset.key,
      borrower,
      status,
      createdAt: d(-10),
      approvedAt: approved ? d(-9) : null,
      handoverAt: handed ? d(-8) : null,
      returnAt: returning ? d(-0.4) : null,
      expectedReturn: d(4),
      condition: status === 'RETURNED' ? 'Normal' : null,
      source: 'SELF_SERVICE',
      delivery: 'PICKUP',
      returnMethod: returning ? 'self_return' : null,
      reason:
        status === 'REJECTED'
          ? 'ต้องสำรองเครื่องสำหรับผู้ป่วยฉุกเฉินของโรงพยาบาล'
          : status === 'CANCELLED'
            ? 'ผู้ป่วยย้ายหอและไม่มีความจำเป็นต้องใช้งานต่อ'
            : null,
      ...options,
    };
    asset.availability = ['PENDING_APPROVE', 'APPROVED'].includes(status)
      ? 'RESERVED'
      : status === 'BORROWED'
        ? 'BORROWED'
        : ['PENDING_RETURN', 'IN_PICKUP'].includes(status)
          ? 'UNAVAILABLE'
          : 'AVAILABLE';
    f.borrows.push(result);
    return result;
  };
  const borrowers = f.users
    .filter(
      (user) =>
        user.role === 'DEPARTMENT_STAFF' && user.verified && !user.deleted,
    )
    .filter(
      (user, index, all) =>
        all.findIndex((peer) => peer.section === user.section) === index,
    );
  for (const borrower of borrowers) {
    for (const status of [
      'PENDING_APPROVE',
      'APPROVED',
      'BORROWED',
      'PENDING_RETURN',
      'IN_PICKUP',
      'RETURNED',
      'REJECTED',
      'CANCELLED',
    ] as const)
      loan(`${borrower.section}-loan-${status}`, borrower.key, status, {
        delivery: status === 'APPROVED' ? 'DELIVERY' : 'PICKUP',
      });
    loan(`${borrower.section}-overdue`, borrower.key, 'BORROWED', {
      expectedReturn: d(-3),
    });
    loan(`${borrower.section}-due-soon`, borrower.key, 'BORROWED', {
      expectedReturn: d(1),
    });
    loan(`${borrower.section}-center-loan`, borrower.key, 'BORROWED', {
      source: 'CENTER_SERVICE',
      delivery: 'DELIVERY',
    });
    for (const status of [
      'PENDING',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
      'DESK',
    ] as const) {
      const parent = loan(
        `${borrower.section}-extension-${status}`,
        borrower.key,
        'BORROWED',
        {
          expectedReturn:
            status === 'APPROVED' || status === 'DESK' ? d(11) : d(4),
        },
      );
      f.extensions.push({
        key: `${parent.key}-request`,
        borrow: parent.key,
        type: status === 'DESK' ? 'DESK' : 'ONLINE',
        status: status === 'DESK' ? 'APPROVED' : status,
        currentDate: d(4),
        requestedDate: d(11),
        createdAt: d(-0.4),
      });
    }
  }
  for (let index = 0; index < 12; index++) {
    const from = f.sections[index % f.sections.length];
    const to = f.sections[(index + 2) % f.sections.length];
    const asset = machine(`transfer-${index}`, to);
    f.transfers.push({
      key: key(`transfer-${index}`),
      asset: asset.key,
      from,
      to,
      date: d(-3 - index * 5),
    });
  }
  for (let index = 0; index < f.sections.length; index++) {
    const section = f.sections[index];
    const disposed = machine(`disposed-${index}`, section, {
      receivedDate: d(-365 * 9 - index * 100),
      status: 'DISPOSAL',
      availability: 'UNAVAILABLE',
    });
    f.disposals.push({
      key: disposed.key,
      asset: disposed.key,
      date: d(-10 - index * 12),
    });
    machine(`wait-disposal-${index}`, section, {
      receivedDate: d(-365 * 8),
      status: 'WAIT_DISPOSAL',
      availability: 'UNAVAILABLE',
    });
    machine(`damaged-${index}`, section, {
      status: 'DAMAGED',
      availability: 'UNAVAILABLE',
    });
    machine(`lost-${index}`, section, {
      status: 'LOST',
      availability: 'UNAVAILABLE',
    });
  }
  // Opening balances include the exact consumed quantity, keeping receipts and stock in agreement.
  for (const part of f.parts.filter((part) => isExpandedScenario(part.key)))
    part.opening += f.txns
      .filter((txn) => txn.part === part.key && txn.stock === 'INTERNAL')
      .reduce(
        (qty, txn) =>
          qty +
          (txn.type === 'WITHDRAW'
            ? txn.qty
            : txn.type === 'RETURN'
              ? -txn.qty
              : 0),
        0,
      );
  for (const user of f.users.filter((user) => user.verified && !user.deleted)) {
    const notices: {
      type: PresentationFixture['notifications'][number]['type'];
      resourceType: PresentationFixture['notifications'][number]['resourceType'];
      resource: string;
      title: string;
    }[] = [];
    if (user.role === 'PARCEL_STAFF') {
      for (const request of f.repairs
        .filter(
          (job) =>
            isExpandedScenario(job.key) &&
            job.track === 'OUTSOURCE' &&
            job.completedSteps === 4,
        )
        .slice(0, 3))
        notices.push({
          type: 'REPAIR_APPROVAL_REQUIRED',
          resourceType: 'REPAIR_JOB',
          resource: request.key,
          title: 'รอพิจารณาการส่งซ่อมภายนอก',
        });
    } else if (user.role === 'ASSET_CENTER_STAFF') {
      for (const request of f.borrows
        .filter(
          (loan) =>
            isExpandedScenario(loan.key) && loan.status === 'PENDING_APPROVE',
        )
        .slice(0, 2))
        notices.push({
          type: 'BORROW_APPROVAL_REQUIRED',
          resourceType: 'BORROW_TRANSACTION',
          resource: request.key,
          title: 'มีคำขอยืมครุภัณฑ์รออนุมัติ',
        });
      const extension = f.extensions.find(
        (row) => isExpandedScenario(row.key) && row.status === 'PENDING',
      );
      if (extension)
        notices.push({
          type: 'BORROW_EXTENSION_APPROVAL_REQUIRED',
          resourceType: 'BORROW_EXTENSION',
          resource: extension.key,
          title: 'รอพิจารณาคำขอต่ออายุการยืม',
        });
    } else if (user.role === 'DEPARTMENT_STAFF') {
      const loans = f.borrows.filter(
        (loan) => isExpandedScenario(loan.key) && loan.borrower === user.key,
      );
      for (const [suffix, type, title] of [
        [
          'loan-APPROVED',
          'BORROW_APPROVED',
          'คำขอยืมครุภัณฑ์ได้รับอนุมัติแล้ว',
        ],
        ['due-soon', 'BORROW_DUE_SOON', 'ครุภัณฑ์ใกล้ครบกำหนดคืน'],
        ['overdue', 'BORROW_OVERDUE', 'ครุภัณฑ์เกินกำหนดคืน'],
      ] as const) {
        const loan = loans.find((row) => row.key.endsWith(suffix));
        if (loan)
          notices.push({
            type,
            resourceType: 'BORROW_TRANSACTION',
            resource: loan.key,
            title,
          });
      }
      for (const status of ['APPROVED', 'REJECTED'] as const) {
        const extension = f.extensions.find(
          (row) =>
            isExpandedScenario(row.key) &&
            row.status === status &&
            loans.some((loan) => loan.key === row.borrow),
        );
        if (extension)
          notices.push({
            type:
              status === 'APPROVED'
                ? 'BORROW_EXTENSION_APPROVED'
                : 'BORROW_EXTENSION_REJECTED',
            resourceType: 'BORROW_EXTENSION',
            resource: extension.key,
            title:
              status === 'APPROVED'
                ? 'อนุมัติการต่ออายุการยืมแล้ว'
                : 'คำขอต่ออายุไม่ได้รับอนุมัติ',
          });
      }
      const delivery = f.repairs.find(
        (job) =>
          isExpandedScenario(job.key) &&
          job.reporter === user.key &&
          job.status === 'WAITING_DELIVERY',
      );
      if (delivery)
        notices.push({
          type: 'REPAIR_READY_FOR_COLLECTION',
          resourceType: 'REPAIR_JOB',
          resource: delivery.key,
          title: 'ซ่อมเสร็จแล้ว กรุณารับครุภัณฑ์คืน',
        });
    }
    for (const [index, notice] of notices.entries())
      f.notifications.push({
        ...notice,
        key: key(`notice-${user.key}-${index}`),
        user: user.key,
        message:
          'ตรวจสอบรายละเอียด ผู้รับผิดชอบ และเอกสารประกอบของรายการในระบบ',
        createdAt: d(-0.3 - index / 24),
        readAt: index % 3 === 2 ? d(-0.1) : null,
      });
  }
}
