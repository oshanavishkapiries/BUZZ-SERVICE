'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import * as Types from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Plus, Trash2, Folder, UserPlus, UserMinus } from 'lucide-react';

export default function UsersPage() {
	const [users, setUsers] = useState<Types.User[]>([]);
	const [applications, setApplications] = useState<Types.Application[]>([]);
	const [selectedApp, setSelectedApp] = useState<Types.Application | null>(null);
	const [members, setMembers] = useState<Types.ApplicationMemberDetail[]>([]);
	const [loadingUsers, setLoadingUsers] = useState(true);
	const [loadingMembers, setLoadingMembers] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	// Create user modal / state
	const [showCreateUser, setShowCreateUser] = useState(false);
	const [createUserName, setCreateUserName] = useState('');
	const [createUserEmail, setCreateUserEmail] = useState('');
	const [createUserPassword, setCreateUserPassword] = useState('');
	const [createUserRole, setCreateUserRole] = useState<'owner' | 'user'>('user');
	const [submittingUser, setSubmittingUser] = useState(false);

	// Add member modal / state
	const [showAddMember, setShowAddMember] = useState(false);
	const [addMemberEmail, setAddMemberEmail] = useState('');
	const [addMemberRole, setAddMemberRole] = useState<'admin' | 'member'>('member');
	const [submittingMember, setSubmittingMember] = useState(false);

	const loadData = async () => {
		setLoadingUsers(true);
		setError(null);
		try {
			const [usersRes, appsRes] = await Promise.all([
				api.listUsers(),
				api.listApplications()
			]);
			setUsers(usersRes.users || []);
			setApplications(appsRes.applications || []);
			
			// Auto select first application if none selected yet
			if (appsRes.applications && appsRes.applications.length > 0 && !selectedApp) {
				const firstApp = appsRes.applications[0];
				setSelectedApp(firstApp);
				loadMembers(firstApp.id);
			} else if (selectedApp) {
				loadMembers(selectedApp.id);
			}
		} catch (err: any) {
			setError(err.message || 'Failed to load user administration data');
		} finally {
			setLoadingUsers(false);
		}
	};

	const loadMembers = async (appId: string) => {
		setLoadingMembers(true);
		try {
			const res = await api.listApplicationMembers(appId);
			setMembers(res.members || []);
		} catch (err: any) {
			console.error(err);
		} finally {
			setLoadingMembers(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	const handleCreateUser = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmittingUser(true);
		setError(null);
		setSuccessMsg(null);

		try {
			await api.createUser({
				name: createUserName,
				email: createUserEmail,
				password: createUserPassword,
				role: createUserRole
			});
			setSuccessMsg(`User account for ${createUserName} created successfully.`);
			setShowCreateUser(false);
			setCreateUserName('');
			setCreateUserEmail('');
			setCreateUserPassword('');
			setCreateUserRole('user');
			await loadData();
		} catch (err: any) {
			setError(err.message || 'Failed to create user');
		} finally {
			setSubmittingUser(false);
		}
	};

	const handleDeleteUser = async (userId: string, name: string) => {
		if (!confirm(`Are you sure you want to permanently delete the user account for "${name}"?`)) return;
		setError(null);
		setSuccessMsg(null);
		try {
			await api.deleteUser(userId);
			setSuccessMsg(`User "${name}" deleted successfully.`);
			await loadData();
		} catch (err: any) {
			setError(err.message || 'Failed to delete user');
		}
	};

	const handleAddMember = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedApp) return;
		setSubmittingMember(true);
		setError(null);
		setSuccessMsg(null);

		try {
			await api.addApplicationMember(selectedApp.id, {
				email: addMemberEmail,
				role: addMemberRole
			});
			setSuccessMsg(`User with email "${addMemberEmail}" added to application "${selectedApp.name}"`);
			setShowAddMember(false);
			setAddMemberEmail('');
			setAddMemberRole('member');
			await loadMembers(selectedApp.id);
		} catch (err: any) {
			setError(err.message || 'Failed to add member to application');
		} finally {
			setSubmittingMember(false);
		}
	};

	const handleRemoveMember = async (userId: string, name: string) => {
		if (!selectedApp) return;
		if (!confirm(`Remove "${name}" from access to application "${selectedApp.name}"?`)) return;
		setError(null);
		setSuccessMsg(null);
		try {
			await api.removeApplicationMember(selectedApp.id, userId);
			setSuccessMsg(`"${name}" removed from application access successfully.`);
			await loadMembers(selectedApp.id);
		} catch (err: any) {
			setError(err.message || 'Failed to remove member');
		}
	};

	const handleSelectApp = (appId: string) => {
		const app = applications.find(a => a.id === appId) || null;
		setSelectedApp(app);
		if (app) {
			loadMembers(app.id);
		}
	};

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="page-header flex items-start justify-between">
				<div>
					<h1 className="text-2xl font-bold text-[var(--text-primary)]">User & Access Management</h1>
					<p className="text-sm text-[var(--text-secondary)] mt-1">Manage system-wide user accounts and assign their application permissions</p>
				</div>
				<Button onClick={() => setShowCreateUser(true)}>
					<Plus size={14} className="mr-1.5" />
					Create User Account
				</Button>
			</div>

			{/* Success and Error messages */}
			{successMsg && (
				<Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
					<AlertDescription>{successMsg}</AlertDescription>
				</Alert>
			)}
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
				{/* 1. Global User Accounts List */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users size={18} className="text-[var(--accent)]" />
							System-wide Users
						</CardTitle>
						<CardDescription>
							All registered accounts. Owners have access to all applications. Standard users must be granted workspace permissions.
						</CardDescription>
					</CardHeader>
					<CardContent className="p-0">
						{loadingUsers ? (
							<div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading users…</div>
						) : users.length === 0 ? (
							<div className="p-8 text-center text-sm text-[var(--text-muted)]">No users found.</div>
						) : (
							<table className="data-table">
								<thead>
									<tr>
										<th>Name</th>
										<th>Email</th>
										<th>System Role</th>
										<th className="text-right">Action</th>
									</tr>
								</thead>
								<tbody>
									{users.map(u => (
										<tr key={u.id}>
											<td className="font-semibold text-xs">{u.name}</td>
											<td className="text-xs text-[var(--text-secondary)] font-mono">{u.email}</td>
											<td>
												<Badge variant={u.role === 'owner' ? 'default' : 'secondary'}>
													{u.role}
												</Badge>
											</td>
											<td className="text-right">
												<Button
													variant="ghost"
													size="icon"
													onClick={() => handleDeleteUser(u.id, u.name)}
													className="h-7 w-7 text-[var(--destructive)] hover:bg-red-50 dark:hover:bg-red-900/20"
													title="Delete User"
												>
													<Trash2 size={13} />
												</Button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</CardContent>
				</Card>

				{/* 2. Workspace Access Members List */}
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2">
								<Folder size={18} className="text-[var(--accent)]" />
								Application Members
							</CardTitle>
							<CardDescription>
								Manage access control and permission roles for specific application workspaces.
							</CardDescription>
						</div>
						{selectedApp && (
							<Button variant="outline" size="sm" onClick={() => setShowAddMember(true)}>
								<UserPlus size={14} className="mr-1.5" />
								Add User
							</Button>
						)}
					</CardHeader>
					<CardContent className="space-y-4">
						{/* App Selector Dropdown */}
						<div className="flex flex-col gap-1.5 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)]">
							<Label htmlFor="appSelect" className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
								Select Application Scope
							</Label>
							<select
								id="appSelect"
								value={selectedApp?.id || ''}
								onChange={e => handleSelectApp(e.target.value)}
								className="w-full px-3 py-2 text-sm rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
							>
								{applications.map(app => (
									<option key={app.id} value={app.id}>
										{app.name}
									</option>
								))}
							</select>
						</div>

						{/* Members table */}
						{selectedApp ? (
							loadingMembers ? (
								<div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading application members…</div>
							) : members.length === 0 ? (
								<div className="p-8 text-center text-sm text-[var(--text-muted)]">No direct members assigned. Owners have access by default.</div>
							) : (
								<div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden">
									<table className="data-table">
										<thead>
											<tr>
												<th>Name</th>
												<th>Workspace Role</th>
												<th className="text-right">Action</th>
											</tr>
										</thead>
										<tbody>
											{members.map(m => (
												<tr key={m.user_id}>
													<td>
														<div className="leading-tight">
															<div className="font-semibold text-xs">{m.name}</div>
															<div className="text-[0.65rem] text-[var(--text-muted)] font-mono">{m.email}</div>
														</div>
													</td>
													<td>
														<Badge variant={m.role === 'owner' ? 'default' : m.role === 'admin' ? 'secondary' : 'outline'}>
															{m.role}
														</Badge>
													</td>
													<td className="text-right">
														{m.role !== 'owner' && (
															<Button
																variant="ghost"
																size="icon"
																onClick={() => handleRemoveMember(m.user_id, m.name)}
																className="h-7 w-7 text-[var(--destructive)] hover:bg-red-50 dark:hover:bg-red-900/20"
																title="Remove member access"
															>
																<UserMinus size={13} />
															</Button>
														)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)
						) : (
							<div className="p-8 text-center text-sm text-[var(--text-muted)]">Please create or select an application workspace first.</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Create User Modal */}
			{showCreateUser && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
					<div className="w-full max-w-md p-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
						<h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Create User Account</h2>
						<p className="text-xs text-[var(--text-muted)] mb-5">Create a login account. Roles dictate global, system-wide settings permissions.</p>

						<form onSubmit={handleCreateUser} className="space-y-4">
							<div>
								<Label htmlFor="cname">Name</Label>
								<Input
									id="cname"
									required
									value={createUserName}
									onChange={e => setCreateUserName(e.target.value)}
									placeholder="e.g. Jane Doe"
								/>
							</div>

							<div>
								<Label htmlFor="cemail">Email Address</Label>
								<Input
									id="cemail"
									type="email"
									required
									value={createUserEmail}
									onChange={e => setCreateUserEmail(e.target.value)}
									placeholder="e.g. jane@company.com"
								/>
							</div>

							<div>
								<Label htmlFor="cpass">Initial Password</Label>
								<Input
									id="cpass"
									type="password"
									required
									value={createUserPassword}
									onChange={e => setCreateUserPassword(e.target.value)}
									placeholder="At least 6 characters"
								/>
							</div>

							<div>
								<Label htmlFor="crole">System-wide Role</Label>
								<select
									id="crole"
									value={createUserRole}
									onChange={e => setCreateUserRole(e.target.value as any)}
									className="w-full px-3 py-2 text-sm rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
								>
									<option value="user">User (Needs application assignment)</option>
									<option value="owner">Owner (Has root access to all applications)</option>
								</select>
							</div>

							<div className="flex items-center justify-end gap-3 mt-6">
								<Button
									type="button"
									variant="ghost"
									onClick={() => setShowCreateUser(false)}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={submittingUser}
								>
									{submittingUser ? 'Creating…' : 'Create Account'}
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Add Member Modal */}
			{showAddMember && selectedApp && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
					<div className="w-full max-w-md p-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
						<h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Grant Application Access</h2>
						<p className="text-xs text-[var(--text-muted)] mb-5">Assign access and permission level to application: <strong>{selectedApp.name}</strong></p>

						<form onSubmit={handleAddMember} className="space-y-4">
							<div>
								<Label htmlFor="memail">User Email Address</Label>
								<Input
									id="memail"
									type="email"
									required
									value={addMemberEmail}
									onChange={e => setAddMemberEmail(e.target.value)}
									placeholder="Email of existing user account"
								/>
								<p className="text-[0.65rem] text-[var(--text-muted)] mt-1">The user account must be created first by the system owner.</p>
							</div>

							<div>
								<Label htmlFor="mrole">Application Permission Role</Label>
								<select
									id="mrole"
									value={addMemberRole}
									onChange={e => setAddMemberRole(e.target.value as any)}
									className="w-full px-3 py-2 text-sm rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
								>
									<option value="member">Member (Can send/read notifications)</option>
									<option value="admin">Admin (Can configure provider settings and keys)</option>
								</select>
							</div>

							<div className="flex items-center justify-end gap-3 mt-6">
								<Button
									type="button"
									variant="ghost"
									onClick={() => setShowAddMember(false)}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={submittingMember}
								>
									{submittingMember ? 'Adding…' : 'Grant Access'}
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
