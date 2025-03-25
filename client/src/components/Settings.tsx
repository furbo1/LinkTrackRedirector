import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function Settings() {
  const [formState, setFormState] = useState({
    name: "John Doe",
    email: "john@example.com",
    defaultUrlDomain: "trk.li",
    linkFormat: "random",
    redirectMode: "302",
    notifyClicks: false,
    notifyWeekly: true
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormState(prev => ({ ...prev, [name]: checked }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="mt-2 text-sm text-gray-700">Configure your link tracking account and preferences.</p>
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {/* Account Settings */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Account Settings</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Personal information and account details.</p>
          </div>
          <div className="border-t border-gray-200">
            <dl>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Full name</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="flex items-center">
                    <span>{formState.name}</span>
                    <Button 
                      variant="link" 
                      className="ml-3 text-sm text-primary-600 hover:text-primary-500 p-0"
                    >
                      Edit
                    </Button>
                  </div>
                </dd>
              </div>
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Email address</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="flex items-center">
                    <span>{formState.email}</span>
                    <Button 
                      variant="link" 
                      className="ml-3 text-sm text-primary-600 hover:text-primary-500 p-0"
                    >
                      Edit
                    </Button>
                  </div>
                </dd>
              </div>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Password</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="flex items-center">
                    <span>••••••••</span>
                    <Button 
                      variant="link" 
                      className="ml-3 text-sm text-primary-600 hover:text-primary-500 p-0"
                    >
                      Change
                    </Button>
                  </div>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* URL Settings */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">URL Settings</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Configure how your tracking links work.</p>
          </div>
          <div className="border-t border-gray-200">
            <dl>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Default URL domain</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="max-w-lg flex rounded-md shadow-sm">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                      https://
                    </span>
                    <Input 
                      type="text" 
                      name="defaultUrlDomain"
                      value={formState.defaultUrlDomain}
                      onChange={handleInputChange}
                      className="flex-1 min-w-0 block rounded-none rounded-r-md"
                    />
                  </div>
                </dd>
              </div>
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Link ID format</dt>
                <dd className="mt-1 sm:mt-0 sm:col-span-2">
                  <RadioGroup 
                    value={formState.linkFormat} 
                    onValueChange={(value) => handleSelectChange('linkFormat', value)}
                    className="space-y-4 sm:flex sm:items-center sm:space-y-0 sm:space-x-10"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="random" id="random" />
                      <Label htmlFor="random">Random characters</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="custom" id="custom" />
                      <Label htmlFor="custom">Custom slugs</Label>
                    </div>
                  </RadioGroup>
                </dd>
              </div>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Redirect mode</dt>
                <dd className="mt-1 sm:mt-0 sm:col-span-2">
                  <Select 
                    value={formState.redirectMode} 
                    onValueChange={(value) => handleSelectChange('redirectMode', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select redirect mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="302">302 Temporary Redirect</SelectItem>
                      <SelectItem value="301">301 Permanent Redirect</SelectItem>
                      <SelectItem value="js">JavaScript Redirect</SelectItem>
                    </SelectContent>
                  </Select>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Notification Settings</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Decide how and when you want to be notified.</p>
          </div>
          <div className="border-t border-gray-200">
            <dl>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Email notifications</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-2">
                      <Checkbox 
                        id="notify-clicks" 
                        checked={formState.notifyClicks}
                        onCheckedChange={(checked) => handleCheckboxChange('notifyClicks', !!checked)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label 
                          htmlFor="notify-clicks" 
                          className="font-medium text-gray-700"
                        >
                          Click milestones
                        </Label>
                        <p className="text-sm text-gray-500">
                          Get notified when your links reach significant click counts.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Checkbox 
                        id="notify-weekly" 
                        checked={formState.notifyWeekly}
                        onCheckedChange={(checked) => handleCheckboxChange('notifyWeekly', !!checked)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label 
                          htmlFor="notify-weekly" 
                          className="font-medium text-gray-700"
                        >
                          Weekly summary
                        </Label>
                        <p className="text-sm text-gray-500">
                          Receive a weekly report of your link performance.
                        </p>
                      </div>
                    </div>
                  </div>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="py-5">
          <div className="flex justify-end">
            <Button variant="outline" className="mr-3">
              Cancel
            </Button>
            <Button type="submit">
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
