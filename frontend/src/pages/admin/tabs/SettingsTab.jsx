import React from 'react';
import { Key } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const SettingsTab = ({
  user,
  showPinForm,
  setShowPinForm,
  pinForm,
  setPinForm,
  handlePinChange,
  // Google users cleanup
  googleUsersData,
  loadingGoogleUsers,
  previewGoogleUsers,
  deleteGoogleUsers,
  // User verification
  userVerifyData,
  loadingUserVerify,
  previewUserVerification,
  executeUserVerification
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700" data-testid="settings-tab">
      <h2 className="text-lg font-bold mb-6 text-slate-800 dark:text-slate-100">
        Admin Settings
      </h2>
      
      <div className="space-y-6">
        {/* Change PIN Section */}
        <div className="p-4 border rounded-lg border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                Change Admin PIN
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Update your admin login PIN
              </p>
            </div>
            <Button
              onClick={() => setShowPinForm(!showPinForm)}
              variant="outline"
              className="flex items-center gap-2"
              data-testid="toggle-pin-form"
            >
              <Key size={18} />
              Change PIN
            </Button>
          </div>

          {showPinForm && (
            <form onSubmit={handlePinChange} className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-600">
              <div>
                <Label className="text-slate-700 dark:text-slate-300">Current PIN</Label>
                <Input
                  type="password"
                  value={pinForm.oldPin}
                  onChange={(e) => setPinForm({ ...pinForm, oldPin: e.target.value })}
                  placeholder="Enter current PIN"
                  required
                  className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                  data-testid="current-pin-input"
                />
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300">New PIN</Label>
                <Input
                  type="password"
                  value={pinForm.newPin}
                  onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value })}
                  placeholder="Enter new PIN (min 4 characters)"
                  required
                  className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                  data-testid="new-pin-input"
                />
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300">Confirm New PIN</Label>
                <Input
                  type="password"
                  value={pinForm.confirmPin}
                  onChange={(e) => setPinForm({ ...pinForm, confirmPin: e.target.value })}
                  placeholder="Confirm new PIN"
                  required
                  className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                  data-testid="confirm-pin-input"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="text-white bg-slate-800 hover:bg-slate-700" data-testid="update-pin-btn">
                  Update PIN
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowPinForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Admin Email Section */}
        <div className="p-4 border rounded-lg border-slate-200 dark:border-slate-600">
          <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-100">
            Admin Email
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {user?.email}
          </p>
        </div>

        {/* Google Users Cleanup Section */}
        <div className="p-4 border rounded-lg border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-300">
                Delete Google Login Users
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400">
                Remove all users who registered via Google social login. They can re-register with email/password.
              </p>
            </div>
            <Button
              onClick={previewGoogleUsers}
              variant="outline"
              disabled={loadingGoogleUsers}
              className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
              data-testid="preview-google-users"
            >
              {loadingGoogleUsers ? 'Checking...' : 'Check Google Users'}
            </Button>
          </div>

          {googleUsersData && (
            <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-800">
              {googleUsersData.users_found === 0 ? (
                <p className="text-green-600 dark:text-green-400 font-medium">
                  No Google login users found. Database is clean.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-red-700 dark:text-red-300 font-medium">
                    Found {googleUsersData.users_found} Google login user(s):
                  </p>
                  <div className="max-h-40 overflow-y-auto bg-white dark:bg-slate-800 rounded p-2 border border-red-200 dark:border-red-700">
                    {googleUsersData.users_to_delete?.map((u, idx) => (
                      <div key={idx} className="text-sm py-1 border-b border-red-100 dark:border-red-800 last:border-0">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{u.email}</span>
                        <span className="text-slate-500 dark:text-slate-400 ml-2">({u.name})</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={deleteGoogleUsers}
                    disabled={loadingGoogleUsers}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    data-testid="delete-google-users"
                  >
                    {loadingGoogleUsers ? 'Deleting...' : `Delete ${googleUsersData.users_found} User(s)`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Verification Section */}
        <div className="p-4 border rounded-lg border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-300">
                Verify Users with Phone Numbers
              </h3>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Mark users with valid phone numbers as verified. Optionally delete users without phone.
              </p>
            </div>
            <Button
              onClick={previewUserVerification}
              variant="outline"
              disabled={loadingUserVerify}
              className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30"
              data-testid="preview-user-verification"
            >
              {loadingUserVerify ? 'Checking...' : 'Preview Users'}
            </Button>
          </div>

          {userVerifyData && (
            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded">
                  <p className="text-lg font-bold text-green-700 dark:text-green-300">{userVerifyData.users_with_phone}</p>
                  <p className="text-sm text-green-600 dark:text-green-400">Users with phone (to verify)</p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded">
                  <p className="text-lg font-bold text-red-700 dark:text-red-300">{userVerifyData.users_without_phone}</p>
                  <p className="text-sm text-red-600 dark:text-red-400">Users without phone (to delete)</p>
                </div>
              </div>
              
              {userVerifyData.users_to_verify?.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Users to verify (sample):</p>
                  <div className="max-h-32 overflow-y-auto bg-white dark:bg-slate-800 rounded p-2 border border-blue-200 dark:border-blue-700 text-sm">
                    {userVerifyData.users_to_verify.slice(0, 5).map((u, idx) => (
                      <div key={idx} className="py-1 border-b border-blue-100 dark:border-blue-800 last:border-0 flex justify-between">
                        <span className="text-slate-800 dark:text-slate-200">{u.email}</span>
                        <span className="text-slate-500 dark:text-slate-400">{u.phone}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userVerifyData.users_without_phone > 0 && (
                <Button
                  onClick={executeUserVerification}
                  disabled={loadingUserVerify}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="execute-user-verification"
                >
                  {loadingUserVerify ? 'Processing...' : `Verify ${userVerifyData.users_with_phone} & Delete ${userVerifyData.users_without_phone} User(s)`}
                </Button>
              )}
              
              {userVerifyData.users_without_phone === 0 && userVerifyData.users_with_phone > 0 && (
                <Button
                  onClick={executeUserVerification}
                  disabled={loadingUserVerify}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  data-testid="verify-users-only"
                >
                  {loadingUserVerify ? 'Processing...' : `Verify ${userVerifyData.users_with_phone} User(s)`}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
