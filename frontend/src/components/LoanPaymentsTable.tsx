import { useState, useEffect } from 'react';
import { Table } from '@mantine/core';
import { inputBaseStyle } from '../styles/sharedInputStyles';

const HEADER_BG_COLOR = '#64b4faff'; // pale yellow
const HEADER_FONT_COLOR = '#000';

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

type LoanPaymentsTableProps = {
    loanStart: string; // ISO date string
    loanEnd: string;   // ISO date string
    monthlyPayment: number;
    loanId: string;
    propertyId: number;
};


export default function LoanPaymentsTable({
    loanStart,
    loanEnd,
    monthlyPayment,
    loanId,
    propertyId,
}: LoanPaymentsTableProps) {
    const startDate = new Date(loanStart);
    const endDate = new Date(loanEnd);
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    const [year, setYear] = useState(startYear);

    // Each key is `${year}-${month}`, value is payment info, saved id, and *storedMonthlyPayment*
    const [paymentData, setPaymentData] = useState<Record<string, {
        paymentAmount: string;
        datePaid: string;
        loan_payment_id?: number | null;
        storedMonthlyPayment?: number;
    }>>({});

    const canPrev = year > startYear;
    const canNext = year < endYear;

    function isRowActive(year: number, monthIndex: number) {
        const rowStartDate = new Date(year, monthIndex, 1);
        const rowEndDate = new Date(year, monthIndex + 1, 0);
        return rowEndDate >= startDate && rowStartDate <= endDate;
    }

    function handlePaymentChange(year: number, monthIndex: number, field: 'paymentAmount' | 'datePaid', value: string) {
        const key = `${year}-${monthIndex}`;
        setPaymentData(prev => {
            const old = prev[key] ?? { paymentAmount: '', datePaid: '', loan_payment_id: null, storedMonthlyPayment: undefined };
            const updated = {
                ...old,
                [field]: value,
            };

            const newPaymentAmount = field === 'paymentAmount' ? value : old.paymentAmount;
            const newDatePaid = field === 'datePaid' ? value : old.datePaid;
            if (
                newPaymentAmount !== '' &&
                newDatePaid !== '' &&
                updated.storedMonthlyPayment === undefined
            ) {
                updated.storedMonthlyPayment = monthlyPayment;
            }

            return { ...prev, [key]: updated };
        });
    }

    // Auto-POST new payment if both fields filled & no payment id
    useEffect(() => {
        Object.entries(paymentData).forEach(([key, payment]) => {
            const { paymentAmount, datePaid, loan_payment_id } = payment;
            if (
                paymentAmount.trim() !== '' &&
                datePaid.trim() !== ''
            ) {
                const [rowYear, monthIndexStr] = key.split('-');
                const monthIndex = Number(monthIndexStr);
                const payment_due_date = new Date(Number(rowYear), monthIndex, 1).toISOString();

                const payload = {
                    loan_id: loanId,
                    property_id: propertyId,
                    payment_due_date,
                    payment_amount: parseFloat(paymentAmount),
                    date_paid: datePaid,
                    principal_paid: 0,
                    interest_paid: 0,
                    late_fee: 0,
                    principal_balance: 0,
                    notes: '',
                };

                // PATCH if exists, POST if new
                if (loan_payment_id === undefined || loan_payment_id === null) {
                    // POST new
                    fetch('/api/loan_payments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                        .then(res => {
                            if (!res.ok) throw new Error('Failed to save payment');
                            return res.json();
                        })
                        .then(savedPayment => {
                            setPaymentData(prev => ({
                                ...prev,
                                [key]: {
                                    ...prev[key],
                                    loan_payment_id: savedPayment.loan_payment_id,
                                }
                            }));
                        })
                        .catch(err => {
                            console.error(err);
                        });
                } else {
                    // PATCH update
                    fetch(`/api/loan_payments/${loan_payment_id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                        .then(res => {
                            if (!res.ok) throw new Error('Failed to update payment');
                            return res.json();
                        })
                        .then(updatedPayment => {
                            setPaymentData(prev => ({
                                ...prev,
                                [key]: {
                                    ...prev[key],
                                    ...updatedPayment,
                                }
                            }));
                        })
                        .catch(err => {
                            console.error(err);
                        });
                }
            }
        });
    }, [paymentData, loanId, propertyId]);

    useEffect(() => {
        if (!loanId || !propertyId) return; // Defensive: skip fetch if missing
        let ignore = false;
        fetch(`/api/loan_payments?loanId=${encodeURIComponent(loanId)}&propertyId=${propertyId}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch loan payments');
                return res.json();
            })
            .then((fetchedPayments: any[]) => {
                if (ignore) return;
                const loaded: typeof paymentData = {};
                fetchedPayments.forEach(payment => {
                    const dueDate = new Date(payment.payment_due_date);
                    const key = `${dueDate.getFullYear()}-${dueDate.getMonth()}`;
                    loaded[key] = {
                        paymentAmount: payment.payment_amount !== undefined && payment.payment_amount !== null ? String(payment.payment_amount) : '',
                        datePaid: payment.date_paid
                            ? new Date(payment.date_paid).toISOString().slice(0, 10)
                            : '',
                        loan_payment_id: payment.loan_payment_id,
                        storedMonthlyPayment:
                            payment.stored_monthly_payment !== undefined && payment.stored_monthly_payment !== null
                                ? payment.stored_monthly_payment
                                : monthlyPayment,
                    };
                });
                setPaymentData(loaded);
            })
            .catch(err => {
                console.error(err);
            });
        return () => {
            ignore = true;
        };
    }, [loanId, propertyId]);

    // --- UI START ---
    return (
        <div style={{ marginTop: 24 }}>
            {/* Section header */}
            <h2
                style={{
                    color: '#a16d37',
                    fontFamily: 'inherit',
                    fontWeight: 800,
                    letterSpacing: '0.03em',
                    fontSize: 22,
                    marginBottom: 20,
                    marginTop: -12,
                    textAlign: 'left',
                }}
            >
                LOAN PAYMENTS TABLE
            </h2>

            {/* Custom minimalist year selector */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'left',
                    gap: 12,
                    marginBottom: 24,
                }}
            >
                <button
                    style={{
                        padding: '10px 28px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        fontFamily: 'inherit',
                        fontSize: 18,
                        background: '#fff',
                        border: '2px solid #111',
                        color: '#111',
                        cursor: 'pointer',
                        borderRadius: 0,
                        boxShadow: 'none',
                        outline: 'none',
                        letterSpacing: 1,
                        transition: 'background 0.15s, color 0.15s',
                    }}
                    onClick={() => canPrev && setYear(year - 1)}
                    disabled={!canPrev}
                >
                    ← PREV
                </button>

                <span
                    style={{
                        fontWeight: 900,
                        fontSize: 25,
                        fontFamily: 'inherit',
                        background: '#97cbf7b4',
                        border: '2px solid #111',
                        color: '#111',
                        letterSpacing: 1,
                        textAlign: 'center' as const,
                        padding: '10px 28px',
                        textTransform: 'uppercase',
                        display: 'inline-block',
                    }}
                >
                    {year}
                </span>

                <button
                    style={{
                        padding: '10px 28px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        fontFamily: 'inherit',
                        fontSize: 18,
                        background: '#fff',
                        border: '2px solid #111',
                        color: '#111',
                        cursor: 'pointer',
                        borderRadius: 0,
                        boxShadow: 'none',
                        outline: 'none',
                        letterSpacing: 1,
                        transition: 'background 0.15s, color 0.15s',
                    }}
                    onClick={() => canNext && setYear(year + 1)}
                    disabled={!canNext}
                >
                    NEXT →
                </button>
            </div>

            {/* Table stays the same */}
            <Table
                striped
                highlightOnHover
                withColumnBorders
                style={{
                    width: '100%',
                    fontFamily: 'inherit',
                    fontSize: 16,
                    border: '2px solid #222',
                    borderCollapse: 'collapse',
                    background: '#fff',
                    textAlign: 'center',
                }}
            >
                <thead>
                    <tr style={{ backgroundColor: HEADER_BG_COLOR, color: HEADER_FONT_COLOR, textTransform: 'uppercase' }}>
                        <th style={{ border: '1px solid #222', padding: 12 }}>Year Due</th>
                        <th style={{ border: '1px solid #222', padding: 12 }}>Month Due</th>
                        <th style={{ border: '1px solid #222', padding: 12 }}>Monthly Payment</th>
                        <th style={{ border: '1px solid #222', padding: 12 }}>Payment Amount</th>
                        <th style={{ border: '1px solid #222', padding: 12 }}>Date Paid</th>
                    </tr>
                </thead>
                <tbody>
                    {MONTHS.map((month, monthIndex) => {
                        const active = isRowActive(year, monthIndex);
                        const key = `${year}-${monthIndex}`;
                        const paymentInfo = paymentData[key] ?? { paymentAmount: '', datePaid: '', loan_payment_id: null, storedMonthlyPayment: undefined };
                        const showMonthlyPayment =
                            paymentInfo.paymentAmount !== '' &&
                            paymentInfo.datePaid !== '' &&
                            typeof paymentInfo.storedMonthlyPayment === 'number';

                        return (
                            <tr
                                key={key}
                                style={{
                                    color: active ? 'inherit' : '#999',
                                    backgroundColor: active ? 'inherit' : '#eee',
                                }}
                            >
                                <td style={{ border: '1px solid #222', padding: 8 }}>{year}</td>
                                <td style={{ border: '1px solid #222', padding: 8 }}>{month}</td>
                                <td style={{ border: '1px solid #222', padding: 8, textAlign: 'right' }}>
                                    {showMonthlyPayment
                                        ? `$${paymentInfo.storedMonthlyPayment!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                        : ''}
                                </td>
<td style={{ border: '1px solid #222', padding: 8, textAlign: 'right' }}>
  <input
    type="number"
    min="0"
    step="0.01"
    value={paymentInfo.paymentAmount}
    disabled={!active}
    onChange={(e) => handlePaymentChange(year, monthIndex, 'paymentAmount', e.target.value)}
    style={inputBaseStyle}
  />
</td>
<td style={{ border: '1px solid #222', padding: 8 }}>
  <input
    type="date"
    value={paymentInfo.datePaid}
    disabled={!active}
    onChange={(e) => handlePaymentChange(year, monthIndex, 'datePaid', e.target.value)}
    style={inputBaseStyle}
  />
</td>
                            </tr>
                        );
                    })}
                </tbody>
            </Table>
        </div>
    );
}
