import { sql } from '@vercel/postgres';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  User,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';

export async function fetchRevenue() {
  // Add noStore() here prevent the response from being cached.
  // This is equivalent to in fetch(..., {cache: 'no-store'}).

  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    // console.log('Fetching revenue data...');
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await sql<Revenue>`SELECT * FROM nextjs_dashboard_revenue`;

    // console.log('Data fetch completed after 3 seconds.');

    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    const data = await sql<LatestInvoiceRaw>`
      SELECT nextjs_dashboard_invoices.amount, nextjs_dashboard_customers.name, nextjs_dashboard_customers.image_url, nextjs_dashboard_customers.email, nextjs_dashboard_invoices.id
      FROM nextjs_dashboard_invoices
      JOIN nextjs_dashboard_customers ON nextjs_dashboard_invoices.customer_id = nextjs_dashboard_customers.id
      ORDER BY nextjs_dashboard_invoices.date DESC
      LIMIT 5`;

    const latestInvoices = data.rows.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest nextjs_dashboard_invoices.');
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = sql`SELECT COUNT(*) FROM nextjs_dashboard_invoices`;
    const customerCountPromise = sql`SELECT COUNT(*) FROM nextjs_dashboard_customers`;
    const invoiceStatusPromise = sql`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM nextjs_dashboard_invoices`;

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0].rows[0].count ?? '0');
    const numberOfCustomers = Number(data[1].rows[0].count ?? '0');
    const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const nextjs_dashboard_invoices = await sql<InvoicesTable>`
      SELECT
        nextjs_dashboard_invoices.id,
        nextjs_dashboard_invoices.amount,
        nextjs_dashboard_invoices.date,
        nextjs_dashboard_invoices.status,
        nextjs_dashboard_customers.name,
        nextjs_dashboard_customers.email,
        nextjs_dashboard_customers.image_url
      FROM nextjs_dashboard_invoices
      JOIN nextjs_dashboard_customers ON nextjs_dashboard_invoices.customer_id = nextjs_dashboard_customers.id
      WHERE
        nextjs_dashboard_customers.name ILIKE ${`%${query}%`} OR
        nextjs_dashboard_customers.email ILIKE ${`%${query}%`} OR
        nextjs_dashboard_invoices.amount::text ILIKE ${`%${query}%`} OR
        nextjs_dashboard_invoices.date::text ILIKE ${`%${query}%`} OR
        nextjs_dashboard_invoices.status ILIKE ${`%${query}%`}
      ORDER BY nextjs_dashboard_invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return nextjs_dashboard_invoices.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch nextjs_dashboard_invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const count = await sql`SELECT COUNT(*)
    FROM nextjs_dashboard_invoices
    JOIN nextjs_dashboard_customers ON nextjs_dashboard_invoices.customer_id = nextjs_dashboard_customers.id
    WHERE
      nextjs_dashboard_customers.name ILIKE ${`%${query}%`} OR
      nextjs_dashboard_customers.email ILIKE ${`%${query}%`} OR
      nextjs_dashboard_invoices.amount::text ILIKE ${`%${query}%`} OR
      nextjs_dashboard_invoices.date::text ILIKE ${`%${query}%`} OR
      nextjs_dashboard_invoices.status ILIKE ${`%${query}%`}
  `;

    const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of nextjs_dashboard_invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql<InvoiceForm>`
      SELECT
        nextjs_dashboard_invoices.id,
        nextjs_dashboard_invoices.customer_id,
        nextjs_dashboard_invoices.amount,
        nextjs_dashboard_invoices.status
      FROM nextjs_dashboard_invoices
      WHERE nextjs_dashboard_invoices.id = ${id};
    `;

    const invoice = data.rows.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const data = await sql<CustomerField>`
      SELECT
        id,
        name
      FROM nextjs_dashboard_customers
      ORDER BY name ASC
    `;

    const nextjs_dashboard_customers = data.rows;
    return nextjs_dashboard_customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all nextjs_dashboard_customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  nextjs_dashboard_customers.id,
		  nextjs_dashboard_customers.name,
		  nextjs_dashboard_customers.email,
		  nextjs_dashboard_customers.image_url,
		  COUNT(nextjs_dashboard_invoices.id) AS total_invoices,
		  SUM(CASE WHEN nextjs_dashboard_invoices.status = 'pending' THEN nextjs_dashboard_invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN nextjs_dashboard_invoices.status = 'paid' THEN nextjs_dashboard_invoices.amount ELSE 0 END) AS total_paid
		FROM nextjs_dashboard_customers
		LEFT JOIN nextjs_dashboard_invoices ON nextjs_dashboard_customers.id = nextjs_dashboard_invoices.customer_id
		WHERE
		  nextjs_dashboard_customers.name ILIKE ${`%${query}%`} OR
        nextjs_dashboard_customers.email ILIKE ${`%${query}%`}
		GROUP BY nextjs_dashboard_customers.id, nextjs_dashboard_customers.name, nextjs_dashboard_customers.email, nextjs_dashboard_customers.image_url
		ORDER BY nextjs_dashboard_customers.name ASC
	  `;

    const nextjs_dashboard_customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return nextjs_dashboard_customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

export async function getUser(email: string) {
  try {
    const user = await sql`SELECT * FROM nextjs_dashboard_users WHERE email=${email}`;
    return user.rows[0] as User;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}
