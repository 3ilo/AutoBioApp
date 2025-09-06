## Prerequisites

- AWS CLI configured with appropriate permissions
- Docker image pushed to Amazon ECR
- SSH key pair for EC2 access

## Step 1: Launch EC2 Instance

### Instance Configuration

- **Instance Type**: `g5.2xlarge`
- **AMI**: Ubuntu 22.04 LTS (or AWS Deep Learning AMI GPU for pre-installed CUDA)
- **Storage**: 75 GB gp3 EBS
- **Security Group**: 
  - Open inbound port 8000 (FastAPI)
  - Open inbound port 22 (SSH)
- **Key Pair**: Create or reuse an SSH key

## Step 2: Connect to Instance

```bash
ssh -i "ssh-key.pem" ec2-user@ec2-54-224-17-28.compute-1.amazonaws.com
```

## Step 3: Install NVIDIA Drivers + Docker GPU Runtime

> **Note**: Skip this section if you chose the AWS Deep Learning AMI GPU (CUDA is pre-installed).

### Update and Install Docker

```bash
sudo apt-get update
sudo apt-get install -y docker.io
```

### Install NVIDIA Driver + Toolkit

```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list \
  | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

### Verify GPU Access

```bash
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

## Step 4: Authenticate with ECR & Pull Image

```bash
aws ecr get-login-password --region us-east-1 \
  | sudo docker login --username AWS --password-stdin 022499005638.dkr.ecr.us-east-1.amazonaws.com

sudo docker pull 022499005638.dkr.ecr.us-east-1.amazonaws.com/auto-bio/illustrations-gen:latest
```

## Step 5: Run FastAPI Container with GPU

```bash
sudo docker run --gpus all -p 8000:8000 \
  022499005638.dkr.ecr.us-east-1.amazonaws.com/auto-bio/illustrations-gen:latest
```

Your application will be accessible at:
```
http://<EC2_PUBLIC_IP>:8000
```

## Step 6: Test Your Application

From your local machine:

```bash
curl http://<EC2_PUBLIC_IP>:8000/docs
```

This should open the FastAPI Swagger UI.

## Step 7: Production Considerations

### Run Container in Background

```bash
sudo docker run -d --gpus all -p 8000:8000 <your_image>
```

### View Container Logs

```bash
sudo docker logs -f <container_id>
```

## Step 8: Cost Management

When you're done with your deployment:

```bash
sudo shutdown now
```

This stops the instance and avoids compute charges. You'll only pay for:
- 50 GB EBS storage (~$4/month)
- Public IPv4 address (~$3.60/month if kept attached)

## Troubleshooting

- Ensure your FastAPI app binds to `0.0.0.0:8000` (not `localhost:8000`)
- Verify security group allows inbound traffic on port 8000
- Check container logs for any startup errors
- Confirm GPU is properly detected with `nvidia-smi`