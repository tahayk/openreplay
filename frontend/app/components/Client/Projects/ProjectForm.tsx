import React, { ChangeEvent, FormEvent, useEffect } from 'react';
import { Icon } from 'UI';
import Project from '@/mstore/types/project';
import { projectStore, useStore } from '@/mstore';
import { App, Segmented, Form, Input, Button, Tooltip } from 'antd';
import { toast } from 'react-toastify';
import { observer } from 'mobx-react-lite';

interface Props {
  project?: Project;
  onClose?: (arg: any) => void;
}

function ProjectForm(props: Props) {
  const [form] = Form.useForm();
  const { onClose } = props;
  const { projectsStore } = useStore();
  const [project, setProject] = React.useState<Project>(new Project(props.project || {}));
  const loading = projectsStore.loading;
  const canDelete = projectsStore.list.length > 1;
  // const pathname = window.location.pathname;
  const mstore = useStore();
  const { modal } = App.useApp();

  const handleEdit = ({ target: { name, value } }: ChangeEvent<HTMLInputElement>) => {
    setProject((prev: Project) => (new Project({ ...prev, [name]: value })));
  };

  const onSubmit = (e: FormEvent) => {
    if (!project) return;
    if (project.id && project.exists()) {
      projectsStore
        .updateProject(project.id, project)
        .then((response: any) => {
          toast.success('Project updated successfully');
          onClose?.(null);
        })
        .catch((error: Error) => {
          toast.error(error.message || 'An error occurred while updating the project');
        });
    } else {
      projectsStore
        .save(project!)
        .then((resp: Project) => {
          toast.success('Project created successfully');
          onClose?.(resp);

          // mstore.searchStore.clearSearch();
          // mstore.searchStoreLive.clearSearch();
          mstore.initClient();

          projectsStore.setConfigProject(parseInt(resp.id!));
        })
        .catch((error: Error) => {
          toast.error(error.message || 'An error occurred while creating the project');
        });
    }
  };

  const handleRemove = async () => {
    modal.confirm({
      title: 'Project Deletion Alert',
      content: 'Are you sure you want to delete this project? Deleting it will permanently remove the project, along with all associated sessions and data.',
      onOk: () => {
        projectsStore.removeProject(project.id!).then(() => {
          if (onClose) {
            onClose(null);
          }
        }).catch((error: Error) => {
          toast.error(error.message || 'An error occurred while deleting the project');
        });
      }
    });
  };

  const handleCancel = () => {
    form.resetFields();
    if (onClose) {
      onClose(null);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      onFinish={onSubmit}
      initialValues={{ ...project }}
    >
      <Form.Item
        label="Name"
        name="name"
        rules={[{ required: true, message: 'Please enter a name' }]}
        className="font-medium"
      >
        <Input
          placeholder="Ex. OpenReplay"
          name="name"
          maxLength={40}
          value={project.name}
          onChange={handleEdit}
          className="font-normal rounded-lg"
        />
      </Form.Item>
      <Form.Item label="Project Type" className="font-medium">
        <div>
          <Segmented
            options={[
              {
                value: 'web',
                label: 'Web'
              },
              {
                value: 'ios',
                label: 'Mobile'
              }
            ]}
            value={project.platform}
            onChange={(value) => {
              // projectsStore.editInstance({ platform: value });
              setProject((prev: Project) => (new Project({ ...prev, platform: value })));
            }}
          />
        </div>
      </Form.Item>
      <div className="mt-6 flex justify-between">
        <div className="flex gap-0 items-center">
          <Button
            htmlType="submit"
            type="primary"
            className="float-left mr-2 btn-add-edit-project"
            loading={loading}
            // disabled={!project.validate}
          >
            {project.exists() ? 'Save' : 'Add'}
          </Button>
          <Button
            type="text"
            onClick={handleCancel}
            className="btn-cancel-project"
          >
            Cancel
          </Button>
        </div>
        {project.exists() && (
          <Tooltip title="Delete project" placement="top">
            <Button
              type="text"
              onClick={handleRemove}
              disabled={!canDelete}
              className="btn-delete-project"
            >
              <Icon name="trash" size="16" />
            </Button>
          </Tooltip>
        )}
      </div>
    </Form>
  );
}

export default observer(ProjectForm);
