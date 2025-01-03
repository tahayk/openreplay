import { observer } from 'mobx-react-lite';
import React from 'react';

import { useStore } from 'App/mstore';
import { namedStore } from 'App/mstore/integrationsStore';
import { Button, Checkbox, Form, Input, Loader } from 'UI';
import { toast } from 'react-toastify';

function IntegrationForm(props: any) {
  const { formFields, name, integrated } = props;
  const { integrationsStore } = useStore();
  const initialSiteId = integrationsStore.integrations.siteId;
  const integrationStore = integrationsStore[name as unknown as namedStore];
  const config = integrationStore.instance;
  const loading = integrationStore.loading;
  const onSave = integrationStore.saveIntegration;
  const onRemove = integrationStore.deleteIntegration;
  const edit = integrationStore.edit;
  const fetchIntegrationList = integrationsStore.integrations.fetchIntegrations;

  const fetchList = () => {
    void fetchIntegrationList(initialSiteId);
  };

  const write = ({ target: { value, name: key, type, checked } }) => {
    if (type === 'checkbox') edit({ [key]: checked });
    else edit({ [key]: value });
  };

  const save = () => {
    const { name, customPath } = props;
    onSave(customPath || name).then(() => {
      fetchList();
      props.onClose();
    }).catch(async (error) => {
      if (error.response) {
        const errorResponse = await error.response.json();
        if (errorResponse.errors && Array.isArray(errorResponse.errors)) {
          toast.error(errorResponse.errors.map((e: any) => e).join(', '));
        } else {
          toast.error('Failed to save integration');
        }
      }
    });
  };

  const remove = () => {
    onRemove().then(() => {
      props.onClose();
      fetchList();
    });
  };

  return (
    <Loader loading={loading}>
      <div className="ph-20">
        <Form>
          {formFields.map(
            ({
              key,
              label,
              placeholder = label,
              component: Component = 'input',
              type = 'text',
              checkIfDisplayed,
              autoFocus = false,
            }) =>
              (typeof checkIfDisplayed !== 'function' ||
                checkIfDisplayed(config)) &&
              (type === 'checkbox' ? (
                <Form.Field key={key}>
                  <Checkbox
                    label={label}
                    name={key}
                    value={config[key]}
                    onChange={write}
                    placeholder={placeholder}
                    type={Component === 'input' ? type : null}
                  />
                </Form.Field>
              ) : (
                <Form.Field key={key}>
                  <label>{label}</label>
                  <Input
                    name={key}
                    value={config[key]}
                    onChange={write}
                    placeholder={placeholder}
                    type={Component === 'input' ? type : null}
                    autoFocus={autoFocus}
                  />
                </Form.Field>
              ))
          )}

          <Button
            onClick={save}
            disabled={!config?.validate()}
            loading={loading}
            variant="primary"
            className="float-left mr-2"
          >
            {config?.exists() ? 'Update' : 'Add'}
          </Button>

          {integrated && (
            <Button loading={loading} onClick={remove}>
              {'Delete'}
            </Button>
          )}
        </Form>
      </div>
    </Loader>
  );
}

export default observer(IntegrationForm);
