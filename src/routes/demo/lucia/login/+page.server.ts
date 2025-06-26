import scryptJs from "scrypt-js";
const scrypt = scryptJs.scrypt;

import { Buffer } from 'node:buffer'; // scrypt-jsで必要になります
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/demo/lucia');
	}
	return {};
};

export const actions: Actions = {
	login: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username');
		const password = formData.get('password');

		if (!validateUsername(username)) {
			return fail(400, {
				message: 'Invalid username (min 3, max 31 characters, alphanumeric only)'
			});
		}
		if (!validatePassword(password)) {
			return fail(400, { message: 'Invalid password (min 6, max 255 characters)' });
		}

		const results = await db.select().from(table.user).where(eq(table.user.username, username));

		const existingUser = results.at(0);
		if (!existingUser) {
			return fail(400, { message: 'Incorrect username or password' });
		}

		const [saltHex, storedHashHex] = existingUser.passwordHash.split(':');
		if (!saltHex || !storedHashHex) {
			// 保存されているハッシュの形式が不正な場合
			return fail(500, { message: 'Stored password hash is invalid' });
		}
		const salt = Buffer.from(saltHex, 'hex');
		const passwordBuffer = Buffer.from(password, 'utf-8');

		// 入力されたパスワードとDBのソルトでハッシュを再計算
		const hashToVerifyBytes = await scrypt(passwordBuffer, salt, 16384, 8, 1, 32);

		// 計算したハッシュが、DBに保存されていたものと一致するか比較
		const validPassword = Buffer.from(hashToVerifyBytes).toString('hex') === storedHashHex;

		if (!validPassword) {
			return fail(400, { message: 'Incorrect username or password' });
		}

		const sessionToken = auth.generateSessionToken();
		const session = await auth.createSession(sessionToken, existingUser.id);
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

		return redirect(302, '/demo/lucia');
	},
	register: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username');
		const password = formData.get('password');

		if (!validateUsername(username)) {
			return fail(400, { message: 'Invalid username' });
		}
		if (!validatePassword(password)) {
			return fail(400, { message: 'Invalid password' });
		}

		const userId = generateUserId();
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const passwordBuffer = Buffer.from(password, 'utf-8');

		const hashBytes = await scrypt(passwordBuffer, salt, 16384, 8, 1, 32);

		// ソルトとハッシュ値を結合して、一つの文字列としてDBに保存
		const passwordHash = `${Buffer.from(salt).toString('hex')}:${Buffer.from(hashBytes).toString('hex')}`;

		try {
			await db.insert(table.user).values({ id: userId, username, passwordHash });

			const sessionToken = auth.generateSessionToken();
			const session = await auth.createSession(sessionToken, userId);
			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
		} catch {
			return fail(500, { message: 'An error has occurred' });
		}
		return redirect(302, '/demo/lucia');
	}
};

function generateUserId() {
	return crypto.randomUUID();
}

function validateUsername(username: unknown): username is string {
	return (
		typeof username === 'string' &&
		username.length >= 3 &&
		username.length <= 31 &&
		/^[a-z0-9_-]+$/.test(username)
	);
}

function validatePassword(password: unknown): password is string {
	return typeof password === 'string' && password.length >= 6 && password.length <= 255;
}
